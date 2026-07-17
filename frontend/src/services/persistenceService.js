import { apiUrl } from "../config";

export async function syncFavorite(kind, item, selected) {
  const url = apiUrl(`/api/saved/${kind}${selected ? "" : `/${encodeURIComponent(item.id)}`}`);
  const response = await fetch(url, selected ? { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: item.id, data: item }) } : { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("Favorite synchronization failed.");
}
