import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSiteLocked, SITE_UNLOCK_AT } from "@/lib/site-lock";
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from "@/lib/admin-auth";

export function proxy(request: NextRequest) {
  if (!isSiteLocked()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Admin panel (and its API) stay reachable so the site can be managed while locked.
  if (pathname === "/closed" || pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|media|placeholders|robots.txt|sitemap.xml).*)",
  ],
};
