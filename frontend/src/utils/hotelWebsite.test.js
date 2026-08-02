import { validHotelWebsiteUrl } from "./hotelWebsite";

test("accepts official and hotel-search HTTPS URLs", () => {
  expect(validHotelWebsiteUrl("https://hotel.test/book")).toBe("https://hotel.test/book");
  expect(validHotelWebsiteUrl("https://www.google.com/travel/hotels?q=Hotel%20Paris")).toContain("google.com/travel/hotels");
});

test.each(["", "not a url", "http://hotel.test", "javascript:alert(1)", "https://user:password@hotel.test", `https://${["example", "com"].join(".")}/hotel`])(
  "rejects an unavailable, unsafe, or placeholder URL: %s",
  (value) => expect(validHotelWebsiteUrl(value)).toBe("")
);
