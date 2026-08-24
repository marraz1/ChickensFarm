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
  // api/cron is excluded for the same reason api/auth is: the scheduler has no
  // session, and a 302 to /login would look like a success to curl. Those routes
  // authenticate themselves with CRON_SECRET. Note this belongs here rather than
  // in PUBLIC_PATHS, which also redirects signed-in users to "/" — wrong for an API.
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest)$).*)",
  ],
};
