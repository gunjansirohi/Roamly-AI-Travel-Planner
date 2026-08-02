const isPlaceholderHost = (hostname) => /^(?:www\.)?example\.(?:com|org|net)$/i.test(hostname);

export function validHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || isPlaceholderHost(url.hostname)) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function hotelWebsiteUrl(officialWebsite, hotelName, city) {
  const officialUrl = validHttpsUrl(officialWebsite);
  if (officialUrl) return officialUrl;

  const query = [hotelName, city].filter((part) => typeof part === "string" && part.trim()).join(" ").trim();
  return query ? `https://www.google.com/travel/hotels?q=${encodeURIComponent(query)}` : "";
}
