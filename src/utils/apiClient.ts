/**
 * Centralized API Client for LectureScript
 * 
 * Supports configurable VITE_API_BASE_URL for decoupled deployments:
 * - Production: Cloudflare Pages -> Render Backend (e.g. https://lecturescript-api.onrender.com)
 * - Local Development: Proxied / Same-Origin (relative paths)
 */

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
export const API_BASE_URL = rawBaseUrl.trim().replace(/\/+$/, '') || (
  typeof window !== 'undefined' && window.location.hostname.endsWith('pages.dev')
    ? 'https://lecturescript-api.onrender.com'
    : ''
);

/**
 * Resolves an API path to the full target URL.
 * If VITE_API_BASE_URL is not set, returns the relative path.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return cleanPath;
  }
  return `${API_BASE_URL}${cleanPath}`;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Standardized fetch wrapper that:
 * 1. Resolves against VITE_API_BASE_URL
 * 2. Enforces credentials: 'include' for secure cross-origin session cookies
 * 3. Sets default JSON content type headers
 * 4. Supports generous timeouts: 180s for AI generation to prevent premature aborts,
 *    and 60s for standard endpoints to comfortably accommodate Render free-tier cold starts.
 * 5. Provides explicit, user-friendly abort error handling to avoid cryptic "signal is aborted without reason" failures.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const url = getApiUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // AI generation routes (/api/generate-notes, /api/generate-flashcards) can take up to 2-3 minutes
  // for large transcripts or during Render free-tier cold starts (~50s).
  const isAiRoute = path.includes('/api/generate-');
  const timeoutMs = options.timeoutMs ?? (isAiRoute ? 180000 : 60000);

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let didTimeout = false;

  const timeoutId = controller
    ? setTimeout(() => {
        didTimeout = true;
        try {
          controller.abort(
            new DOMException(
              `Request timed out after ${Math.round(timeoutMs / 1000)} seconds while processing study notes.`,
              'TimeoutError'
            )
          );
        } catch {
          controller.abort();
        }
      }, timeoutMs)
    : null;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal || (controller ? controller.signal : undefined),
    });
    return res;
  } catch (err: any) {
    if (didTimeout || err?.name === 'AbortError' || err?.name === 'TimeoutError' || /aborted/i.test(err?.message || '')) {
      throw new Error(
        'The request took longer than expected to process. The server may be waking up or processing a very long lecture transcript. Please try again or test with a shorter section.'
      );
    }
    throw err;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
