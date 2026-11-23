import { NextRequest, NextResponse } from "next/server";

/**
 * Blokada dostępu bez sesji na poziomie żądania (edge, przed renderem).
 * Zasady ról i właściciela danych sprawdzane są DODATKOWO po stronie
 * serwera w zapytaniach — middleware tylko odsyła niezalogowanych na /login.
 * Ciasteczko jest podpisane (jose, HS256) i weryfikowane na serwerze w
 * src/lib/auth.ts; tutaj tylko obecność — weryfikację podpisu robi warstwa
 * danych (fail-closed: brak/śmieć/wygasłe = brak dostępu do danych).
 */
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get("tp_nets_session")?.value);

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!isPublic && !hasCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
