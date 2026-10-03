import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSiteLocked, SITE_UNLOCK_AT } from "@/lib/site-lock";
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from "@/lib/admin-auth";
import { COUNTRY_COOKIE, countryFromHeaders } from "@/lib/geo";

export function proxy(request: NextRequest) {
  const response = route(request);
  stampCountry(request, response);
  return response;
}

function route(request: NextRequest) {
  if (!isSiteLocked()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Admin panel (and its API) stay reachable so the site can be managed while locked.
  if (pathname === "/closed" || pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  // Stripe keeps reporting payments while the site is closed — a checkout paid
  // just before the lock must still become an order, and expired ones must
  // still give their stock back. A 503 here would only queue retries.
  if (pathname === "/api/stripe/webhook") {
    return NextResponse.next();
  }

  // A logged-in admin browses the live site normally.
  if (request.cookies.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "Site is temporarily closed", unlockAt: SITE_UNLOCK_AT },
      { status: 503 }
    );
  }

  return NextResponse.rewrite(new URL("/closed", request.url));
}

/** Hands the visitor's country to the browser, where lib/region.ts picks the
 * store from it. Page requests only, and only when it changed, so the cookie
 * isn't rewritten on every hit. Readable by JS on purpose — it's just a
 * country code. */
function stampCountry(request: NextRequest, response: NextResponse) {
  if (request.nextUrl.pathname.startsWith("/api")) return;
  const country = countryFromHeaders(request.headers);
  if (!country || request.cookies.get(COUNTRY_COOKIE)?.value === country) return;
  response.cookies.set(COUNTRY_COOKIE, country, { path: "/", sameSite: "lax" });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|media|placeholders|robots.txt|sitemap.xml).*)",
  ],
};
