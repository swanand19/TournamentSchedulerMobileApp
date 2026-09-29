// What a failed request says to the person using the app. Ported from the website's
// api/errors.js so both apps word failures the same way.
//
// The API explains its own rules in status.message of its { status, data } envelope ("Minutes per
// half must be at least 1."), and those pass straight through. What gets translated is everything
// that doesn't: a bare status code, an older server's plain-text or problem-details body, an HTML
// error page (IIS itself failing), or the server not being reachable at all.

function serverMessage(text: string): string {
  const t = (text || '').trim();
  if (!t) return '';
  if (t.startsWith('<')) return ''; // an HTML error page
  if (t.startsWith('{')) {
    try {
      const body = JSON.parse(t);
      if (typeof body.status?.message === 'string') return body.status.message;
      const firstFieldError = body.errors && (Object.values(body.errors) as unknown[]).flat()[0];
      return String(firstFieldError || body.detail || body.message || body.title || '');
    } catch {
      return t;
    }
  }
  return t;
}

function messageFor(status: number, text: string): string {
  const server = serverMessage(text);
  if (status >= 500) {
    const readable = server && server.length < 200 && !server.includes('\n');
    return readable ? server : 'The server ran into a problem. Wait a moment and try again.';
  }
  if (status === 404) return server || 'That item no longer exists. Go back and reload the list.';
  if (status === 409) return server || 'Something changed since this screen loaded. Reload it and try again.';
  return server || `The request was refused (error ${status}). Reload and try again.`;
}

/** An error the API answered with. Keeps the status for code that needs to tell cases apart. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The server couldn't be reached at all: wrong address, laptop off, or not on the same Wi-Fi. */
export class NetworkError extends Error {
  constructor(readonly baseUrl: string) {
    super(`Can't reach the server at ${baseUrl.replace(/^https?:\/\//, '')}. Check the laptop is on and on the same Wi-Fi, or change the server address.`);
    this.name = 'NetworkError';
  }
}

export async function responseError(res: Response): Promise<ApiError> {
  return new ApiError(messageFor(res.status, await res.text()), res.status);
}
