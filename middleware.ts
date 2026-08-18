import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_COOKIE, verifySession } from "@/app/lib/portalSession";

/**
 * Gate for the internal portal.
 *
 * Credentials live in PORTAL_USER / PORTAL_PASS and are never checked into the
 * repo — set them in .env.local locally and in the Vercel project settings for
 * production. If either is missing the portal refuses to serve rather than
 * falling back to a default, so a misconfigured deploy fails closed.
 *
 * Unauthenticated requests are redirected to an ordinary login page rather than
 * answered with a 401 challenge: a WWW-Authenticate response makes the browser
 * raise its own credential dialog, which we cannot style and which appears as a
 * popup over whatever page triggered it.
 */
export const config = { matcher: ["/portal/:path*", "/api/freshtake"] };

const LOGIN = "/portal/login";
const HOME = "/portal/florida-governor";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!process.env.PORTAL_USER || !process.env.PORTAL_PASS) {
    return new NextResponse("Portal is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const authed = await verifySession(req.cookies.get(PORTAL_COOKIE)?.value);

  if (pathname === LOGIN) {
    if (authed) return NextResponse.redirect(new URL(HOME, req.url));
    return NextResponse.next();
  }

  if (!authed) {
    // The data route is fetched by script, so redirecting it to HTML would just
    // hand the client a login page to parse as JSON.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const url = new URL(LOGIN, req.url);
    // Only ever round-trip an internal /portal path, so this cannot be turned
    // into an open redirect.
    if (pathname.startsWith("/portal/")) url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
