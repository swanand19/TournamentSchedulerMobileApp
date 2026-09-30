import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

import { base64UrlDecode, decryptResponse, encryptRequest } from './gatewayCrypto';
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

export async function sealRequest(serviceRequestId: ServiceRequestId, payload: GatewayPayload): Promise<SealedEnvelope> {
  const { keyId, key } = serverPublicKey();
  const requestUUID = ExpoCrypto.randomUUID();
  const timestamp = new Date().toISOString();

  const { token, contentKey } = encryptRequest({
    serverPublicKey: key,
    keyId,
    claims: { serviceRequestId, requestUUID, timestamp },
    plaintext: utf8ToBytes(JSON.stringify(payload)),
    randomBytes: (length) => ExpoCrypto.getRandomBytes(length),
  });

  return {
    envelope: {
      requestHeader: {
        serviceRequestId,
        requestUUID,
        timestamp,
        journeyId,
        sessionId: null,
        channel,
        appVersion: Constants.expoConfig?.version ?? 'unknown',
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

/**
 * The { status, data } envelope inside an encrypted answer, or undefined when the answer wasn't
 * encrypted (the server refused the request before it could decrypt it, so it had no key to reply with).
 * Throws GatewayCryptoError when an encrypted answer can't be opened.
 */
export function openResponse(outer: unknown, contentKey: Uint8Array): unknown {
  const token = (outer as { responseBody?: { encryptedData?: unknown } } | null)?.responseBody?.encryptedData;
  if (typeof token !== 'string') return undefined;
  return JSON.parse(bytesToUtf8(decryptResponse(token, contentKey)));
}
