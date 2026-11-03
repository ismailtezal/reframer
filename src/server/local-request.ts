/**
 * Reframer's server exists only for this computer. Requests from other websites (CSRF) and from
 * unexpected host names (DNS rebinding) are refused, so a page open in your normal browser can't drive
 * the editor, read your projects or spend your API keys.
 *
 * The proxy applies this to every API route except the ones that stream large bodies (uploads and
 * transcription audio): Next buffers a proxied request's body and silently cuts it at the proxy body
 * limit, so those routes call it themselves.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const hostnameOf = (host: string) => (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.replace(/:\d+$/, ""));

const deny = (reason: string) => new Response(reason, { status: 403 });

/** A 403 response for a request that didn't come from this computer's own app, otherwise null. */
export const refuseNonLocal = (request: Request, pathname = new URL(request.url).pathname): Response | null => {
  const host = request.headers.get("host") ?? "";
  if (!LOCAL_HOSTS.has(hostnameOf(host))) return deny("Reframer only answers on localhost.");

  const origin = request.headers.get("origin");
  const readOnly = request.method === "GET" || request.method === "HEAD";
  // The renderer's headless Chrome reads media from its own localhost port.
  if (readOnly && pathname.startsWith("/api/media/")) {
    if (origin && !LOCAL_HOSTS.has(hostnameOf(new URL(origin).host))) return deny("Cross-origin media requests are not allowed.");
    return null;
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") return deny("Cross-site requests are not allowed.");
  if (origin) {
    let o: URL;
    try {
      o = new URL(origin);
    } catch {
      return deny("Bad origin.");
    }
    if (o.host !== host) return deny("Cross-origin requests are not allowed.");
  }
  return null;
};
