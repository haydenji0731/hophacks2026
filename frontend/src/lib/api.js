/** Public detector origin. Empty in `npm run dev` (Vite /api proxy). */
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export function apiUrl(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE) return `${API_BASE}${suffix}`;
  return `/api${suffix}`;
}
