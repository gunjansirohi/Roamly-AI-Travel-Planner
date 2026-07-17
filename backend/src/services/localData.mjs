import { readFile } from "node:fs/promises";

const dataUrl = (name) => new URL(`../../data/${name}.json`, import.meta.url);
const memo = new Map();
export async function localData(name) {
  if (!memo.has(name)) memo.set(name, readFile(dataUrl(name), "utf8").then(JSON.parse));
  return memo.get(name);
}
