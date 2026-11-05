/** httpOnly cookie holding the short-lived JWT access token. Shared with `src/proxy.ts`. */
export const SESSION_COOKIE = "nexa_access_token";

/** httpOnly cookie holding the single-use refresh token rotated on every refresh. */
export const REFRESH_COOKIE = "nexa_refresh_token";
