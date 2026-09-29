import { NetworkError, responseError } from './errors';
import { ROUTES, type ServiceRequestId } from './routes';

// The one way the app talks to the API. Screens call api.call("SERVICE_ID", { ... }) and get plain
// data back; they never see fetch, URLs, keys or the response envelope. When the encrypted gateway
// lands, only this file changes.
//
// Every API response is { status: { isSuccess, message, statusCode }, data }. Screens get `data`;
// a failure becomes an ApiError carrying `status.message` (see errors.ts).

export type CallOptions = {
  /** Fills `{name}` placeholders in the route. */
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

function buildUrl(root: string, path: string, options: CallOptions): string {
  const filled = path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = options.routeParams?.[name];
    if (value === undefined) throw new Error(`Missing route parameter "${name}".`);
    return encodeURIComponent(String(value));
  });

  const query = Object.entries(options.query ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  return `${root}/api/${filled}${query ? `?${query}` : ''}`;
}

/** A single request to `root`, with a timeout. Exported for the Server screen's connection test. */
export async function request<T>(
  root: string,
  serviceRequestId: ServiceRequestId,
  options: CallOptions = {},
): Promise<T> {
  const route = ROUTES[serviceRequestId];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  let res: Response;
  try {
    res = await fetch(buildUrl(root, route.path, options), {
      method: route.method,
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    // Unreachable, refused, or timed out: all mean the same thing to the scorer.
    throw new NetworkError(root);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw await responseError(res);
  if (res.status === 204) return null as T;
  const body: unknown = await res.json();
  return (isEnvelope(body) ? body.data : body) as T;
}

type Envelope = { status: { isSuccess: boolean; message: string | null; statusCode: number }; data: unknown };

/** Tolerates a server from before the envelope, so the app and API can be updated in either order. */
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
