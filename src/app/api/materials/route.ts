import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * Dodanie pozycji do WSPÓLNEGO katalogu materiałów (monter i szef).
 * Tylko nazwa + jednostka katalogowa. NIE tworzy zakupu, ceny ani
 * przyjęcia na magazyn — to osobny proces (szef, moduł kosztów).
 * Duplikat (ta sama nazwa i jednostka): zwracamy istniejący rekord
 * zamiast tworzyć nowy (material_ok=existing).
 */
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

    const raw = body as { name?: unknown; base_unit?: unknown };
    const name =
      typeof raw.name === "string" ? raw.name.trim().slice(0, 200) : "";
    const baseUnit =
      typeof raw.base_unit === "string" ? raw.base_unit.trim().slice(0, 20) : "";

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Nazwa materiału jest wymagana." },
        { status: 400 }
      );
    }
    if (!baseUnit) {
      return NextResponse.json(
        { ok: false, error: "Jednostka materiału jest wymagana (np. szt., m)." },
        { status: 400 }
      );
    }

    // duplikat po nazwie (UNIQUE w schemacie): zwróć istniejący zamiast błędu,
    // jeśli jednostka się zgadza
    const existing = await query<{
      id: number;
      name: string;
      base_unit: string;
    }>(
      `SELECT id, name, base_unit FROM materials WHERE lower(name) = lower($1)`,
      [name]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.base_unit.toLowerCase() === baseUnit.toLowerCase()) {
        return NextResponse.json({
          ok: true,
          material: row,
          material_existing: true,
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error: `Materiał „${row.name}” już istnieje w katalogu z jednostką „${row.base_unit}”. Wybierz go z listy lub podaj inną nazwę.`,
        },
        { status: 400 }
      );
    }

    const ins = await query<{ id: number; name: string; base_unit: string }>(
      `INSERT INTO materials (name, base_unit, is_active)
       VALUES ($1, $2, true)
       RETURNING id, name, base_unit`,
      [name, baseUnit]
    );
    return NextResponse.json({
      ok: true,
      material: ins.rows[0],
      material_existing: false,
    });
  } catch (err) {
    console.error("POST /api/materials:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — materiał nie został dodany." },
      { status: 500 }
    );
  }
}
