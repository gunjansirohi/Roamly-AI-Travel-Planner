import { apiUrl } from "../config";

export async function dataRequest(path, options = {}) {
  let response;
  try { response = await fetch(apiUrl(`/api${path}`), { credentials: "include", headers: { "Content-Type": "application/json", ...options.headers }, ...options }); }
  catch { throw new Error("Unable to reach Roamly. Check your connection and try again."); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "The request could not be completed.");
  return payload;
}
export const listTrips = (page = 1) => dataRequest(`/trips?page=${page}&limit=12`);
export const updateTrip = (id, values) => dataRequest(`/trips/${id}`, { method: "PUT", body: JSON.stringify(values) });
export const deleteTrip = (id) => dataRequest(`/trips/${id}`, { method: "DELETE" });
export const duplicateTrip = (id) => dataRequest(`/trips/${id}/duplicate`, { method: "POST" });
export const favoriteTrip = (id, favorite) => dataRequest(`/trips/${id}/favorite`, { method: "PUT", body: JSON.stringify({ favorite }) });
export const saveProviderItem = (type, item) => dataRequest(`/saved/${type}`, { method: "POST", body: JSON.stringify({ providerId: item.id, data: item }) });
export const getDashboard = () => dataRequest("/dashboard");
export const recordSearch = (query, category, metadata) => dataRequest("/search-history", { method: "POST", body: JSON.stringify({ query, category, metadata }) });
export const deleteSearch = (id) => {
  const searchId = String(id || "").trim();
  if (!/^[a-f\d]{24}$/i.test(searchId)) return Promise.reject(new Error("This recent search has an invalid identifier and could not be removed."));
  return dataRequest(`/search-history/${encodeURIComponent(searchId)}`, { method: "DELETE" }).catch((error) => {
    if (/route not found/i.test(error.message)) throw new Error("Recent-search deletion is not available on the current API deployment. Please deploy the latest backend and try again.");
    throw error;
  });
};
