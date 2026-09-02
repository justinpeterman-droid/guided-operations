/**
 * Leave protected App Router content with a document navigation after a
 * session-ending action. This ensures the next page load sees the new cookie
 * state instead of a stale in-memory route cache.
 */
export function redirectToLogin() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Session-ending redirects must discard protected App Router state.
  window.location.assign("/login");
}
