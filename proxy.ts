import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/unauthorized", "/api/webhooks/kissflow"];
const PAYROLL_PATHS = ["/exports", "/api/exports"];
const ADMIN_PATHS = ["/users", "/api/users", "/api/employees"];

function startsWithAny(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function bootstrapEmails() {
  return new Set(
    (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function securityHeaders(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", isDev ? "'unsafe-eval'" : ""]
    .filter(Boolean)
    .join(" ");
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      isDev ? "" : "upgrade-insecure-requests",
    ]
      .filter(Boolean)
      .join("; "),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

function secure(response: NextResponse, nonce: string) {
  for (const [name, value] of Object.entries(securityHeaders(nonce))) {
    response.headers.set(name, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function redirectWithCookies(url: URL, current: NextResponse, nonce: string) {
  const redirect = NextResponse.redirect(url);
  current.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return secure(redirect, nonce);
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(
    "Content-Security-Policy",
    securityHeaders(nonce)["Content-Security-Policy"]
  );

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return secure(
      NextResponse.json({ error: "Authentication is not configured" }, { status: 503 }),
      nonce
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isPublic = startsWithAny(pathname, PUBLIC_PATHS);
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (isPublic) {
    if (pathname === "/login" && claims?.sub) {
      return redirectWithCookies(new URL("/", request.url), response, nonce);
    }
    return secure(response, nonce);
  }

  if (!claims?.sub) {
    const login = new URL("/login", request.url);
    if (!pathname.startsWith("/api/")) login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    if (pathname.startsWith("/api/")) {
      return secure(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), nonce);
    }
    return redirectWithCookies(login, response, nonce);
  }

  const email = String(claims.email ?? "").toLowerCase();
  const { data: profile } = await supabase
    .from("app_users")
    .select("role,active")
    .eq("user_id", claims.sub)
    .maybeSingle();
  const role = profile?.role ?? (bootstrapEmails().has(email) ? "admin" : null);
  const active = profile ? profile.active === true : role === "admin";

  if (!role || !active) {
    if (pathname.startsWith("/api/")) {
      return secure(NextResponse.json({ error: "Forbidden" }, { status: 403 }), nonce);
    }
    return redirectWithCookies(new URL("/unauthorized", request.url), response, nonce);
  }

  if (startsWithAny(pathname, ADMIN_PATHS) && role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return secure(NextResponse.json({ error: "Forbidden" }, { status: 403 }), nonce);
    }
    return redirectWithCookies(new URL("/unauthorized", request.url), response, nonce);
  }

  if (startsWithAny(pathname, PAYROLL_PATHS) && role !== "admin" && role !== "cfo") {
    if (pathname.startsWith("/api/")) {
      return secure(NextResponse.json({ error: "Forbidden" }, { status: 403 }), nonce);
    }
    return redirectWithCookies(new URL("/unauthorized", request.url), response, nonce);
  }

  return secure(response, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
