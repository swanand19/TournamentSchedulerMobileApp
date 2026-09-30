import { apiError, NetworkError, unreadableAnswer } from './errors';
import { openResponse, sealRequest } from './gateway';
import type { ServiceRequestId } from './services';

// The one way the app talks to the API. Screens call api.call("SERVICE_ID", { ... }) and get plain
// data back; they never see fetch, URLs, keys or the response envelope.
//
// Every call goes through the secure gateway: the request is encrypted for the server's public key
// and posted to {server}/api/gateway, and the answer comes back encrypted for this request alone
// (see gateway.ts). Inside, the answer is the usual { status: { isSuccess, message, statusCode },
// data }; screens get `data`, and a failure becomes an ApiError carrying `status.message`.

export type CallOptions = {
  /** Values for the service's route parameters, by name — e.g. { matchId: 42 }. */
  routeParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Milliseconds before giving up. Scoring calls are short; the default is generous for Wi-Fi. */
  timeoutMs?: number;
};

let baseUrl = '';

/** Set by ServerProvider whenever the saved server address changes. */
export function setApiBaseUrl(url: string) {
  baseUrl = url.replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  return baseUrl;
}

/** A single request to the server at `root`, with a timeout. Exported for the Server screen's connection test. */
export async function request<T>(
  root: string,
  serviceRequestId: ServiceRequestId,
  options: CallOptions = {},
): Promise<T> {
  const query = Object.fromEntries(
    Object.entries(options.query ?? {}).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined),
  );
  const sealed = await sealRequest(serviceRequestId, { routeParams: options.routeParams, query, body: options.body });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  let res: Response;
  let text: string;
  try {
    res = await fetch(`${root}/api/gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sealed.envelope),
      signal: controller.signal,
    });
    text = await res.text();
  } catch {
    // Unreachable, refused, or timed out: all mean the same thing to the scorer.
    throw new NetworkError(root);
  } finally {
    clearTimeout(timer);
  }

  let outer: unknown = null;
  try {
    outer = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON (an IIS error page, say): errors.ts words it from the status alone.
  }

  let envelope: unknown;
  try {
    envelope = openResponse(outer, sealed.contentKey);
  } catch {
    throw unreadableAnswer(res.status);
  } finally {
    sealed.contentKey.fill(0);
  }

  // Refused before decryption: the gateway could only answer in the clear.
  if (envelope === undefined) {
    throw apiError(res.status, text);
  }

  if (!res.ok || (isEnvelope(envelope) && !envelope.status.isSuccess)) {
    throw apiError(res.status, JSON.stringify(envelope));
  }
  return (isEnvelope(envelope) ? envelope.data : envelope) as T;
}

type Envelope = { status: { isSuccess: boolean; message: string | null; statusCode: number }; data: unknown };

export function isEnvelope(body: unknown): body is Envelope {
  if (typeof body !== 'object' || body === null || !('data' in body) || !('status' in body)) return false;
  const status = (body as { status: unknown }).status;
  return typeof status === 'object' && status !== null && typeof (status as { isSuccess?: unknown }).isSuccess === 'boolean';
}

export const api = {
  call<T>(serviceRequestId: ServiceRequestId, options?: CallOptions): Promise<T> {
    if (!baseUrl) return Promise.reject(new NetworkError('(no server set)'));
    return request<T>(baseUrl, serviceRequestId, options);
  },
};
