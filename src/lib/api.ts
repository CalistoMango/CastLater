import { APP_URL } from '~/lib/constants';

/**
 * Centralized API fetch helper for cross-origin requests from Warpcast miniapp.
 *
 * This function ensures all API calls:
 * - Use absolute URLs (required when running in Warpcast miniapp iframe)
 * - Include credentials (cookies) for NextAuth session validation
 * - Work correctly for both same-origin and cross-origin contexts
 *
 * @param path - API path starting with '/' (e.g., '/api/users/123')
 * @param init - Standard fetch RequestInit options
 * @returns Promise<Response> from the fetch call
 * @throws Error if path doesn't start with '/'
 *
 * @example
 * // GET request
 * const res = await apiFetch('/api/users/123');
 *
 * @example
 * // POST request
 * const res = await apiFetch('/api/casts/schedule', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ content, scheduled_time }),
 * });
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith('/')) {
    throw new Error(`apiFetch expected a leading slash: "${path}"`);
  }

  const { credentials, ...rest } = init;
  return fetch(`${APP_URL}${path}`, {
    credentials: credentials ?? 'include',
    ...rest,
  });
}
