import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * PATCH /api/materials/[id] — zmiana nazwy lub jednostki domyślnej,
 * wycofanie z wyboru (is_active=false) bez usuwania historii.
 * Jednostka domyślna to PODPOWIEDŹ: zużycie może zapisać inną jednostkę
 * (np. 0,5 paczki albo 20 szt.) — aplikacja nie sumuje bez przelicznika.
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
    const materialId = Number(id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy materiał." },
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

    const raw = body as { name?: unknown; base_unit?: unknown; is_active?: unknown };

    const sets: string[] = [];
    const values: unknown[] = [];

    if (raw.name !== undefined) {
      const name = String(raw.name ?? "").trim();
      if (!name || name.length > 200) {
        return NextResponse.json(
          { ok: false, error: "Nazwa materiału jest wymagana (max 200 znaków)." },
          { status: 400 }
        );
      }
      // Unikalność nazwy (schemat) — sprawdź kolizję z innym materiałem.
      const clash = await query<{ id: number }>(
        `SELECT id FROM materials WHERE lower(name) = lower($1) AND id <> $2`,
        [name, materialId]
      );
      if (clash.rows.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Inny materiał ma już tę nazwę." },
          { status: 400 }
        );
      }
      sets.push(`name = $${values.push(name)}`);
    }

    if (raw.base_unit !== undefined) {
      const unit = String(raw.base_unit ?? "").trim();
      if (!unit || unit.length > 20) {
        return NextResponse.json(
          { ok: false, error: "Jednostka jest wymagana (max 20 znaków)." },
          { status: 400 }
        );
      }
      sets.push(`base_unit = $${values.push(unit)}`);
    }

    if (raw.is_active !== undefined) {
      // Wycofanie/z powrotem; historia (zakupy, zużycia) bez zmian.
      sets.push(`is_active = $${values.push(raw.is_active === true)}`);
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Brak zmian do zapisania." },
        { status: 400 }
      );
    }

    values.push(materialId);
    const res = await query<{ id: number }>(
      `UPDATE materials SET ${sets.join(", ")}
       WHERE id = $${values.length} RETURNING id`,
      values as never[]
    );
    if (res.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Materiał nie istnieje." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/materials/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — materiał nie został zapisany." },
      { status: 500 }
    );
  }
}
