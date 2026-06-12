/** Base URL of the ASP.NET Core backend (no trailing slash). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001').replace(
  /\/$/,
  '',
)
