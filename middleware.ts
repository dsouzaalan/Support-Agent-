import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("auth-session");
  const isAuthPath = request.nextUrl.pathname.startsWith("/auth");

  if (!session && !isAuthPath) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  if (session && isAuthPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
