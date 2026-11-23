import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/** GET /api/contacts?location_id=N — aktywne kontakty obiektu (osoby zlecające). */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }
    if (!req.url.includes("location_id=")) {
      return NextResponse.json(
        { ok: false, error: "Podaj poprawny obiekt." },
        { status: 400 }
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

    const res = await query<{
      id: number;
      full_name: string;
      phone: string | null;
    }>(
      `SELECT id, full_name, phone
       FROM location_contacts
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
