import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { withTransaction } from "@/lib/db";

/**
 * PATCH /api/locations/[id] — edycja obiektu: nazwa, adres.
 * DELETE /api/locations/[id] — usunięcie obiektu: TYLKO szef i tylko gdy
 * obiekt nie ma żadnych zleceń (historia nie może stracić powiązania).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }
    if (session.role !== "boss") {
      return NextResponse.json(
        { ok: false, error: "Tylko szef może usuwać obiekty." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const locationId = Number(id);
    if (!Number.isInteger(locationId) || locationId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy obiekt." },
        { status: 400 }
      );
    }

    // Usuwanie obiektu: jeśli ma zlecenia — szef musi je najpierw usunąć
    // (zlecenia są usuwalne przez PATCH /api/orders/[id] action=delete,
    // także zamknięte). Liczymy AKTYWNE i ZAMKNIĘTE — bez ukrytych resztek.
    const ordersCount = await query<{ count: string }>(
      `SELECT count(*) AS count FROM orders WHERE location_id = $1`,
      [locationId]
    );
    if (Number(ordersCount.rows[0].count) > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Obiekt ma zlecenia — usuń najpierw jego zlecenia (zakładka Zlecenia, przycisk „Usuń zlecenie”).",
        },
        { status: 400 }
      );
    }

    await query(`DELETE FROM location_contacts WHERE location_id = $1`, [locationId]);
    const res = await query<{ id: number }>(
      `DELETE FROM locations WHERE id = $1 RETURNING id`,
      [locationId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Obiekt nie istnieje." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/locations/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — obiekt nie został usunięty." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/locations/[id] — edycja obiektu: nazwa, adres. Reguły:
 * - nazwa nie może kolidować z innym obiektem,
 * - zmiana obiektu w ZLECENIU z raportami — osobna trasa (orders/[id]/edit,
 *   tam reguła boss). Tu: sama definicja obiektu.
 * - Nie zmienia nazw obiektów przypisanych do istniejącej historii raportów
 *   bez potwierdzenia klienta (frontend pyta, bo nazwa widać w raportach).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const locationId = Number(id);
    if (!Number.isInteger(locationId) || locationId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy obiekt." },
        { status: 400 }
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
    const sets: string[] = [];
    const values: unknown[] = [];

    if (raw.name !== undefined) {
      const name = String(raw.name ?? "").trim();
      if (!name || name.length > 200) {
        return NextResponse.json(
          { ok: false, error: "Nazwa obiektu jest wymagana (max 200 znaków)." },
          { status: 400 }
        );
      }
      const clash = await query<{ id: number }>(
        `SELECT id FROM locations WHERE lower(name) = lower($1) AND id <> $2`,
        [name, locationId]
      );
      if (clash.rows.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Inny obiekt ma już tę nazwę." },
          { status: 400 }
        );
      }
      sets.push(`name = $${values.push(name)}`);
    }

    if (raw.address !== undefined) {
      const address =
        typeof raw.address === "string" && raw.address.trim()
          ? raw.address.trim().slice(0, 300)
          : "(adres do uzupełnienia)";
      sets.push(`address = $${values.push(address)}`);
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Brak zmian do zapisania." },
        { status: 400 }
      );
    }

    values.push(locationId);
    const res = await query<{ id: number }>(
      `UPDATE locations SET ${sets.join(", ")}
       WHERE id = $${values.length} RETURNING id`,
      values as never[]
    );
    if (res.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Obiekt nie istnieje." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/locations/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — obiekt nie został zapisany." },
      { status: 500 }
    );
  }
}
