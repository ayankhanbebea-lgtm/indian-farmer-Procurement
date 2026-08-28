import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secretKey = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production-please");

const roleForPrefix = (pathname: string) => {
  if (pathname.startsWith("/farmer")) return "FARMER";
  if (pathname.startsWith("/staff")) return "STAFF";
  if (pathname.startsWith("/admin")) return "ADMIN";
  return null;
};

const dashboardFor = (role: string) => {
  if (role === "FARMER") return "/farmer/dashboard";
  if (role === "STAFF") return "/staff/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/";
};

const homeFor = (role: string) => {
  if (role === "FARMER") return "/farmer";
  if (role === "STAFF") return "/staff";
  if (role === "ADMIN") return "/admin";
  return "/";
};

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = req.cookies.get("sp_session")?.value;

  // Handle /login and /register — prevent login-page flash if already authenticated
  if (pathname === "/login" || pathname === "/register") {
    if (token) {
      try {
        const { payload } = await jwtVerify(token, secretKey());
        const role = payload.role as string | undefined;
        if (role) {
          return NextResponse.redirect(new URL(dashboardFor(role), req.url));
        }
      } catch {
        // Token is invalid/expired, let them proceed to login page and clear bad cookie
        const res = NextResponse.next();
        res.cookies.set("sp_session", "", { path: "/", maxAge: 0 });
        return res;
      }
    }
    return NextResponse.next();
  }

  const requiredRole = roleForPrefix(pathname);
  if (!requiredRole) return NextResponse.next();

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== requiredRole) {
      // Logged in as different role — redirect to their own dashboard
      const home = homeFor(payload.role as string);
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  } catch {
    // Expired or invalid token: clear cookie and redirect to login
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.set("sp_session", "", { path: "/", maxAge: 0 });
    return res;
  }
}

export const config = {
  matcher: [
    "/farmer",
    "/farmer/:path*",
    "/staff",
    "/staff/:path*",
    "/admin",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
