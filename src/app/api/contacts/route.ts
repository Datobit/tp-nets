import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * POST /api/contacts — nowy kontakt (osoba zlecająca) dla obiektu.
 * Używany inline z formularza zlecenia („Dodaj zlecającego”) — przypisany
 * zawsze do WYBRANEGO obiektu. GET: kontakty obiektu (?location_id=N).
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }
    const url = new URL(req.url);
    const locationId = Number(url.searchParams.get("location_id"));
    if (!Number.isInteger(locationId) || locationId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Podaj poprawny obiekt." },
        { status: 400 }
      );
    }
    const res = await query<{ id: number; full_name: string; phone: string | null }>(
      `SELECT id, full_name, phone FROM location_contacts
       WHERE location_id = $1 AND is_active
       ORDER BY full_name`,
      [locationId]
    );
    return NextResponse.json({ ok: true, contacts: res.rows });
  } catch (err) {
    console.error("GET /api/contacts:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — nie udało się pobrać kontaktów." },
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

    const raw = body as {
      location_id?: unknown;
      full_name?: unknown;
      phone?: unknown;
    };
    const locationId = Number(raw.location_id);
    if (!Number.isInteger(locationId) || locationId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Najpierw wybierz obiekt." },
        { status: 400 }
      );
    }
    const fullName = typeof raw.full_name === "string" ? raw.full_name.trim() : "";
    if (!fullName || fullName.length > 120) {
      return NextResponse.json(
        { ok: false, error: "Imię i nazwisko zlecającego jest wymagane (max 120 znaków)." },
        { status: 400 }
      );
    }
    const phone =
      typeof raw.phone === "string" && raw.phone.trim()
        ? raw.phone.trim().slice(0, 40)
        : null;

    const loc = await query<{ id: number }>(
      `SELECT id FROM locations WHERE id = $1`,
      [locationId]
    );
    if (loc.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Wybrany obiekt nie istnieje." },
        { status: 400 }
      );
    }

    // Duplikat w tym samym obiekcie: zwróć istniejący zamiast błędu.
    const existing = await query<{ id: number; full_name: string; phone: string | null }>(
      `SELECT id, full_name, phone FROM location_contacts
       WHERE location_id = $1 AND lower(full_name) = lower($2)`,
      [locationId, fullName]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({
        ok: true,
        contact: existing.rows[0],
        contact_existing: true,
      });
    }

    const ins = await query<{ id: number; full_name: string; phone: string | null }>(
      `INSERT INTO location_contacts (location_id, full_name, phone, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, full_name, phone`,
      [locationId, fullName, phone]
    );
    return NextResponse.json({
      ok: true,
      contact: ins.rows[0],
      contact_existing: false,
    });
  } catch (err) {
    console.error("POST /api/contacts:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — kontakt nie został dodany." },
      { status: 500 }
    );
  }
}
