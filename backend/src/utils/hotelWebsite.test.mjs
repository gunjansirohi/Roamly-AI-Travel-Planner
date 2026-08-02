import assert from "node:assert/strict";
import test from "node:test";
import { hotelWebsiteUrl, validHttpsUrl } from "./hotelWebsite.mjs";

test("keeps a valid official HTTPS hotel website", () => {
  assert.equal(hotelWebsiteUrl("https://hotel.test/book", "Hotel", "Paris"), "https://hotel.test/book");
});

test("generates a Google Hotels search when the official website is unavailable or invalid", () => {
  const missing = hotelWebsiteUrl("", "Grand Hotel", "Paris");
  const invalid = hotelWebsiteUrl("http://hotel.test", "Grand Hotel", "Paris");
  assert.match(missing, /^https:\/\/www\.google\.com\/travel\/hotels\?q=/);
  assert.equal(invalid, missing);
});

test("rejects unsafe URLs and cannot generate a link without hotel context", () => {
  assert.equal(validHttpsUrl("javascript:alert(1)"), "");
  assert.equal(validHttpsUrl("https://user:password@hotel.test"), "");
  assert.equal(validHttpsUrl(`https://${["example", "com"].join(".")}/hotel`), "");
  assert.equal(hotelWebsiteUrl("", "", ""), "");
});
