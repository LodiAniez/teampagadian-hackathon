import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/cookie-names";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE);
  const path = request.nextUrl.pathname;

  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/invoices") ||
    path.startsWith("/setup-profile");
  const isAuthPage = path.startsWith("/login") || path.startsWith("/verify");

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/invoices/:path*", "/setup-profile/:path*", "/login", "/verify"],
};
