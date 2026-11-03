import { type NextRequest, NextResponse } from "next/server";
import { refuseNonLocal } from "./server/local-request";

/** Only this computer's own app may call the API (see refuseNonLocal). */
export function proxy(request: NextRequest) {
  return refuseNonLocal(request, request.nextUrl.pathname) ?? NextResponse.next();
}

// Uploads and transcription audio stream large bodies: a proxied body is buffered and cut at the proxy
// body limit, so those two routes skip the proxy and call refuseNonLocal themselves.
export const config = { matcher: ["/api/((?!projects/[^/]+/media$|ai/transcribe$).*)"] };
