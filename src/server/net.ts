import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Guards for fetching URLs on an agent's behalf: public http(s) hosts only, so
 * a prompt-injected agent can't reach this machine or the local network.
 */
const isPrivateAddress = (address: string): boolean => {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.");
};

export const assertPublicUrl = async (raw: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That isn't a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http and https links can be imported.");
  if (url.username || url.password) throw new Error("Links with credentials aren't allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("Only public internet addresses can be imported.");
  }
  return url;
};

/** fetch() that re-checks every redirect hop against the public-address rule. */
export const fetchPublic = async (raw: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> => {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects.");
};
