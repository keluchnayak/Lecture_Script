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

/**
 * Standardized fetch wrapper that:
 * 1. Resolves against VITE_API_BASE_URL
 * 2. Enforces credentials: 'include' for secure cross-origin session cookies
 * 3. Sets default JSON content type headers
 * 4. Supports a 45-second timeout to accommodate Render free-tier cold starts
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = getApiUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Use AbortController if no external signal provided, with 45s timeout for cold starts
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 45000) : null;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal || (controller ? controller.signal : undefined),
    });
    return res;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
