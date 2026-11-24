import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

import { agreeKey, base64UrlDecode, decryptResponse, encryptRequest, type AgreedKey } from './gatewayCrypto';
import type { ServiceRequestId } from './services';

// The phone's half of the secure gateway: builds the { requestHeader, requestBody } envelope,
// encrypts it for the server's public key, and opens the encrypted answer. The format is described
// in TournamentScheduler.Api/Gateway/README.md.
//
// The server's public key comes from .env.local (EXPO_PUBLIC_GATEWAY_KEY_ID / _PUBLIC_KEY), printed
// by `dotnet run -- gateway-keys show` on the laptop. It is public by design — only the laptop's
// private key can read what is encrypted with it.

const KEY_ID = process.env.EXPO_PUBLIC_GATEWAY_KEY_ID;
const PUBLIC_KEY = process.env.EXPO_PUBLIC_GATEWAY_PUBLIC_KEY;

/** The app was built without the server's key, or with one that isn't a key. */
export class GatewaySetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewaySetupError';
  }
}

let serverKey: Uint8Array | null = null;

function serverPublicKey(): { keyId: string; key: Uint8Array } {
  if (!KEY_ID || !PUBLIC_KEY) {
    throw new GatewaySetupError(
      'This app has no server key. Add EXPO_PUBLIC_GATEWAY_KEY_ID and EXPO_PUBLIC_GATEWAY_PUBLIC_KEY to .env.local ' +
        "(run 'dotnet run -- gateway-keys show' in the API folder), then restart Expo.",
    );
  }
  if (!serverKey) {
    let decoded: Uint8Array;
    try {
      decoded = base64UrlDecode(PUBLIC_KEY.trim());
    } catch {
      decoded = new Uint8Array(0);
    }
    if (decoded.length !== 65 || decoded[0] !== 0x04) {
      throw new GatewaySetupError("EXPO_PUBLIC_GATEWAY_PUBLIC_KEY isn't a server key. Copy it again from 'gateway-keys show'.");
    }
    serverKey = decoded;
  }
  return { keyId: KEY_ID, key: serverKey };
}

// Keys agreed ahead of time. Agreeing a one-time key with the server is the slow part of a request
// (elliptic-curve arithmetic in JavaScript, on the same thread that answers taps and starts
// animations), so a few are prepared while the app is idle and a request just takes one — its
// sealing then costs almost nothing at the moment of the tap. Every request still gets a key of its
// own, made once and never reused; an empty pool simply falls back to agreeing on the spot.
const POOL_SIZE = 4;
const pool: AgreedKey[] = [];
let filling = false;

const whenIdle = (work: () => void) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(work, { timeout: 3000 });
  else setTimeout(work, 100);
};

/** Tops the pool up, one key per idle moment so no single turn holds the thread for long. */
function refill() {
  if (filling || pool.length >= POOL_SIZE) return;
  filling = true;
  whenIdle(() => {
    filling = false;
    try {
      pool.push(agreeKey({ serverPublicKey: serverPublicKey().key, randomBytes: (length) => ExpoCrypto.getRandomBytes(length) }));
    } catch {
      return; // no usable server key: the request itself reports that
    }
    refill();
  });
}

// The first keys (and the tables behind them) are made as the app starts, before anyone taps.
refill();

// Groups this launch's requests in the server's logs. Named user flows can refine it later.
const journeyId = ExpoCrypto.randomUUID();

const DEVICE_KEY = 'gateway.deviceId';
let deviceIdPromise: Promise<string> | null = null;

/** A random id made once per install — not a hardware identifier. */
function deviceId(): Promise<string> {
  deviceIdPromise ??= (async () => {
    try {
      const saved = await AsyncStorage.getItem(DEVICE_KEY);
      if (saved) return saved;
      const created = ExpoCrypto.randomUUID();
      await AsyncStorage.setItem(DEVICE_KEY, created);
      return created;
    } catch {
      return journeyId; // storage unavailable: still unique enough for this launch's logs
    }
  })();
  return deviceIdPromise;
}

const channel = Platform.OS === 'ios' ? 'MOBILE_IOS' : Platform.OS === 'android' ? 'MOBILE_ANDROID' : 'MOBILE_WEB';

export type GatewayPayload = {
  routeParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
};

export type SealedEnvelope = {
  envelope: {
    requestHeader: Record<string, string | null>;
    requestBody: { encryptedData: string };
  };
  contentKey: Uint8Array;
  requestUUID: string;
};

/**
 * `session` (for the server this request goes to) is sealed into the payload — never put in the
 * clear header, where anyone on the Wi-Fi could copy it. The header carries only the session's id,
 * for the server's logs.
 */
export async function sealRequest(
  serviceRequestId: ServiceRequestId,
  payload: GatewayPayload,
  session: { token: string; sessionId: string } | null = null,
): Promise<SealedEnvelope> {
  const { keyId, key } = serverPublicKey();
  const requestUUID = ExpoCrypto.randomUUID();
  const timestamp = new Date().toISOString();
  const appVersion = Constants.expoConfig?.version ?? 'unknown';

  const { token, contentKey } = encryptRequest({
    serverPublicKey: key,
    keyId,
    // The channel and version are sealed too: the server's update check reads them (HLD P-25).
    claims: { serviceRequestId, requestUUID, timestamp, channel, appVersion },
    plaintext: utf8ToBytes(JSON.stringify(session ? { ...payload, session: session.token } : payload)),
    randomBytes: (length) => ExpoCrypto.getRandomBytes(length),
    agreed: pool.pop(),
  });
  refill();

  return {
    envelope: {
      requestHeader: {
        serviceRequestId,
        requestUUID,
        timestamp,
        journeyId,
        sessionId: session?.sessionId ?? null,
        channel,
        appVersion,
        deviceId: await deviceId(),
        keyId,
        apiVersion: '1',
      },
      requestBody: { encryptedData: token },
    },
    contentKey,
    requestUUID,
  };
}

/** base64url as the padded base64 the phone's own AES takes, without decoding it in JavaScript. */
function toBase64(text: string): string {
  const plain = text.replace(/-/g, '+').replace(/_/g, '/');
  return plain + '='.repeat((4 - (plain.length % 4)) % 4);
}

let warnedAboutFallback = false;

/**
 * Opens an answer with the phone's own AES-GCM (expo-crypto): the same check and the same bytes as
 * gatewayCrypto's decryptResponse, but done natively and off the JavaScript thread. In JavaScript a
 * large answer (a scorecard, a stats page) held that thread — the one that answers taps and starts
 * animations — for as long as it took to decrypt; natively it costs it almost nothing.
 */
async function openNatively(token: string, contentKey: Uint8Array): Promise<Uint8Array> {
  const parts = token.split('.');
  if (parts.length !== 5) throw new Error('A compact JWE has five parts.');
  const header = JSON.parse(bytesToUtf8(base64UrlDecode(parts[0]))) as { alg?: unknown; enc?: unknown };
  if (header.alg !== 'dir' || header.enc !== 'A256GCM') throw new Error('Unexpected response algorithm.');

  const key = await ExpoCrypto.AESEncryptionKey.import(contentKey);
  const sealed = ExpoCrypto.AESSealedData.fromParts(toBase64(parts[2]), toBase64(parts[3]), toBase64(parts[4]));
  // The protected header is the additional data, exactly as it was sent (RFC 7516 §5.1 step 14).
  return ExpoCrypto.aesDecryptAsync(sealed, key, { additionalData: utf8ToBytes(parts[0]) });
}

/**
 * The { status, data } envelope inside an encrypted answer, or undefined when the answer wasn't
 * encrypted (the server refused the request before it could decrypt it, so it had no key to reply with).
 * Throws GatewayCryptoError when an encrypted answer can't be opened.
 */
export async function openResponse(outer: unknown, contentKey: Uint8Array): Promise<unknown> {
  const token = (outer as { responseBody?: { encryptedData?: unknown } } | null)?.responseBody?.encryptedData;
  if (typeof token !== 'string') return undefined;
  let plain: Uint8Array;
  try {
    plain = await openNatively(token, contentKey);
  } catch (e) {
    // Whatever went wrong natively, the JavaScript implementation decides: it opens the answer, or
    // refuses it with the error the app reports. (It is the one checked against the shared vectors.)
    plain = decryptResponse(token, contentKey);
    if (__DEV__ && !warnedAboutFallback) {
      warnedAboutFallback = true;
      console.warn('Gateway: native AES could not open an answer the JavaScript one could; answers are being decrypted in JavaScript.', e);
    }
  }
  return JSON.parse(bytesToUtf8(plain));
}
