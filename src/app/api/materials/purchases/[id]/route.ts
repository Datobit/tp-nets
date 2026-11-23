import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * PATCH /api/materials/purchases/[id] — poprawka zakupu: kupujący, ilość,
 * jednostka, cena. Wymagane zalogowanie; każda zmiana pojedynczo opcjonalna.
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
    const purchaseId = Number(id);
    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy zakup." },
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

    const raw = body as {
      purchased_qty?: unknown;
      unit?: unknown;
      total_price_net?: unknown;
      buyer_name?: unknown;
    };

    // Walidacja tylko przesłanych pól; brak pola = bez zmiany.
    const sets: string[] = [];
    const values: unknown[] = [];

    if (raw.purchased_qty !== undefined) {
      const qty = Number(raw.purchased_qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          { ok: false, error: "Ilość musi być liczbą dodatnią." },
          { status: 400 }
        );
      }
      sets.push(`purchased_qty = $${values.push(qty)}`);
    }
    if (raw.unit !== undefined) {
      const unit = String(raw.unit ?? "").trim();
      if (!unit || unit.length > 20) {
        return NextResponse.json(
          { ok: false, error: "Podaj jednostkę (max 20 znaków)." },
          { status: 400 }
        );
      }
      sets.push(`unit = $${values.push(unit)}`);
    }
    if (raw.total_price_net !== undefined) {
      const price = Number(raw.total_price_net);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json(
          { ok: false, error: "Cena musi być liczbą nieujemną." },
          { status: 400 }
        );
      }
      sets.push(`total_price_net = $${values.push(price)}`);
    }

    if (sets.length > 0) {
      values.push(purchaseId);
      const res = await query<{ id: number }>(
        `UPDATE material_purchases SET ${sets.join(", ")}
         WHERE id = $${values.length} RETURNING id`,
        values as never[]
      );
      if (res.rows.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Zakup nie istnieje." },
          { status: 404 }
        );
      }
    }

    if (raw.buyer_name !== undefined) {
      const buyer = String(raw.buyer_name ?? "").trim();
      if (!buyer || buyer.length > 100) {
        return NextResponse.json(
          { ok: false, error: "Podaj kupującego (max 100 znaków)." },
          { status: 400 }
        );
      }
      await query(
        `INSERT INTO material_purchases_ext_info (purchase_id, buyer_name)
         VALUES ($1, $2)
         ON CONFLICT (purchase_id) DO UPDATE SET buyer_name = EXCLUDED.buyer_name`,
        [purchaseId, buyer]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/materials/purchases/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — zakup nie został zapisany." },
      { status: 500 }
    );
  }
}
