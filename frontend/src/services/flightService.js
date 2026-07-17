import { apiUrl } from "../config";

export async function searchFlights(search, signal) {
  const params = new URLSearchParams(Object.entries(search).filter(([, value]) => value));
  const response = await fetch(apiUrl(`/api/flights?${params}`), { signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Unable to load flight suggestions.");
  return payload;
}
