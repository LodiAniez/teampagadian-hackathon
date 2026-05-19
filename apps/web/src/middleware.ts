import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("raket_access_token");
  const path = request.nextUrl.pathname;

  const isProtected = path.startsWith("/dashboard") || path.startsWith("/setup-profile");
  const isAuthPage = path.startsWith("/login") || path.startsWith("/verify");

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/setup-profile/:path*", "/login", "/verify"],
};
