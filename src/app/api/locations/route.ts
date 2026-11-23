import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * POST /api/locations — nowy obiekt (nazwa wymagana, adres opcjonalny).
 * GET /api/locations — lista obiektów.
 * PATCH /api/locations/[id] — edycja nazwy/adresu (patrz plik [id]/route.ts).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }
    const res = await query<{ id: number; name: string; address: string }>(
      `SELECT id, name, address FROM locations ORDER BY name`
    );
    return NextResponse.json({ ok: true, locations: res.rows });
  } catch (err) {
    console.error("GET /api/locations:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — nie udało się pobrać obiektów." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe dane formularza." },
        { status: 400 }
      );
    }

    const raw = body as { name?: unknown; address?: unknown };
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name || name.length > 200) {
      return NextResponse.json(
        { ok: false, error: "Nazwa obiektu jest wymagana (max 200 znaków)." },
        { status: 400 }
      );
    }
    const address =
      typeof raw.address === "string" && raw.address.trim()
        ? raw.address.trim().slice(0, 300)
        : "(adres do uzupełnienia)";

    const dup = await query<{ id: number }>(
      `SELECT id FROM locations WHERE lower(name) = lower($1)`,
      [name]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Obiekt o tej nazwie już istnieje." },
        { status: 400 }
      );
    }

    const ins = await query<{ id: number }>(
      `INSERT INTO locations (name, address) VALUES ($1, $2) RETURNING id`,
      [name, address]
    );
    return NextResponse.json({
      ok: true,
      location: { id: ins.rows[0].id, name, address },
    });
  } catch (err) {
    console.error("POST /api/locations:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — obiekt nie został dodany." },
      { status: 500 }
    );
  }
}
