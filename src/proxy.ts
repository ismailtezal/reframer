import { type NextRequest, NextResponse } from "next/server";

/**
 * Reframer's server exists only for this computer. Requests from other
 * websites (CSRF) and from unexpected host names (DNS rebinding) are refused,
 * so a page open in your normal browser can't drive the editor, read your
 * projects or spend your API keys.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const hostnameOf = (host: string) => (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.replace(/:\d+$/, ""));

const deny = (reason: string) => new NextResponse(reason, { status: 403 });

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!LOCAL_HOSTS.has(hostnameOf(host))) return deny("Reframer only answers on localhost.");

  const origin = request.headers.get("origin");
  const readOnly = request.method === "GET" || request.method === "HEAD";
  // The renderer's headless Chrome reads media from its own localhost port.
  if (readOnly && request.nextUrl.pathname.startsWith("/api/media/")) {
    if (origin && !LOCAL_HOSTS.has(hostnameOf(new URL(origin).host))) return deny("Cross-origin media requests are not allowed.");
    return NextResponse.next();
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
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
