const isPlaceholderHost = (hostname) => /^(?:www\.)?example\.(?:com|org|net)$/i.test(hostname);

export function validHotelWebsiteUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || isPlaceholderHost(url.hostname)) return "";
    return url.href;
  } catch {
    return "";
  }
}
