import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && isPublic) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  // Static assets must stay outside the auth redirect: the manifest and the app
  // icons are fetched by the browser/OS while signed out, and a redirect to
  // /login makes them arrive as HTML — which is why an installed app showed no
  // icon.
  //
  // api/cron and api/health are excluded for the same reason api/auth is: the
  // caller has no session, and a 302 to /login would look like a success to curl
  // — a health check that can never report ill. Both authenticate themselves
  // with CRON_SECRET. Note this belongs here rather than in PUBLIC_PATHS, which
  // also redirects signed-in users to "/" — wrong for an API.
  //
  // api/health carries a `$` while the other two do not: those need to cover
  // their sub-routes, whereas health is a single endpoint, and an unanchored
  // prefix would quietly place any later /api/health* route outside auth.
  //
  // sw.js is excluded for the same reason as the manifest: the browser fetches
  // it before any session exists, and a redirect would hand back /login HTML,
  // which fails registration with a MIME/type error rather than anything
  // obviously auth-related. Only that exact path is opened, not all .js.
  matcher: [
    "/((?!api/auth|api/cron|api/health$|sw\\.js|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest)$).*)",
  ],
};
