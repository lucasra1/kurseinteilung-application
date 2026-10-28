import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_PERSONA_HEADER } from "@/lib/demo";
import { env } from "@/lib/env";

const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/einladung\//,
  /^\/auth\//,
  /^\/api\/keepalive$/,
];

/** Refreshes the Supabase session cookie and sends logged-out users to /login. */
export async function proxy(request: NextRequest) {
  if (env.DEMO_MODE) return demoProxy(request);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isPublic = PUBLIC_PATHS.some((path) =>
    path.test(request.nextUrl.pathname),
  );

  if (!data?.claims && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

const DEMO_PUBLIC_PATHS = [
  /^\/demo(\/|$)/,
  /^\/einladung\//,
  /^\/api\/keepalive$/,
];

/**
 * Demo mode has no login: the person comes from the demo cookie, or in a Schaufenster
 * frame from the persona header. A frame's first page load can't send headers, so its
 * URL carries the person as `?als=`.
 */
function demoProxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/demo", request.url));
  }

  const headers = new Headers(request.headers);
  const als = searchParams.get("als");
  if (als) headers.set(DEMO_PERSONA_HEADER, als);

  const hasPersona =
    headers.has(DEMO_PERSONA_HEADER) || request.cookies.has(DEMO_COOKIE);
  if (!hasPersona && !DEMO_PUBLIC_PATHS.some((path) => path.test(pathname))) {
    return NextResponse.redirect(new URL("/demo", request.url));
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
