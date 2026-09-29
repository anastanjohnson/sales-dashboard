// The Firebase site uses the Supabase API. Render keeps its same-origin cookie API.
const apiBase = (import.meta.env.VITE_DASHBOARD_API_URL || "").replace(/\/$/, "");
const sessionKey = "karikaala.firebase.session";
export async function apiFetch(path, options = {}) {
  if (!apiBase) return fetch(path, options);
  if (!path.startsWith("/api/")) throw new Error("Invalid API path");
  const headers = new Headers(options.headers);
  const token = sessionStorage.getItem(sessionKey);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    const response = await fetch(`${apiBase}${path}`, { ...options, headers, credentials: "omit", cache: "no-store" });
    if (path === "/api/login" && response.ok) {
      const result = await response.clone().json();
      sessionStorage.setItem(sessionKey, result.token);
    }
    if (response.status === 401) sessionStorage.removeItem(sessionKey);
    return response;
  } finally {
    if (path === "/api/logout") sessionStorage.removeItem(sessionKey);
  }
}
