import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * Zakładka Materiały — zakupy. POST dodaje zakup (kupujący, ilość, jednostka,
 * cena). PATCH /api/materials/purchases/[id] poprawia wpis. Jednostka zakupu
 * może różnić się od jednostki katalogowej (podpowiedź) — bez przelicznika
 * aplikacja NIE sumuje pozycji w różnych jednostkach.
 */

function buyerName(): string {
  return ""; // wypełniane przez klienta (pole „Kupujący”)
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
      material_id?: unknown;
      purchase_date?: unknown;
      purchased_qty?: unknown;
      unit?: unknown;
      total_price_net?: unknown;
      buyer_name?: unknown;
    };

    const materialId = Number(raw.material_id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Wybierz materiał z katalogu." },
        { status: 400 }
      );
    }
    const purchaseDate = String(raw.purchase_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      return NextResponse.json(
        { ok: false, error: "Podaj poprawną datę zakupu." },
        { status: 400 }
      );
    }
    const qty = Number(raw.purchased_qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { ok: false, error: "Ilość musi być liczbą dodatnią." },
        { status: 400 }
      );
    }
    const unit = String(raw.unit ?? "").trim();
    if (!unit || unit.length > 20) {
      return NextResponse.json(
        { ok: false, error: "Podaj jednostkę (max 20 znaków)." },
        { status: 400 }
      );
    }
    const price = Number(raw.total_price_net);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { ok: false, error: "Cena musi być liczbą nieujemną." },
        { status: 400 }
      );
    }
    const buyer = String(raw.buyer_name ?? buyerName()).trim();
    if (!buyer || buyer.length > 100) {
      return NextResponse.json(
        { ok: false, error: "Podaj kupującego (max 100 znaków)." },
        { status: 400 }
      );
    }

    const material = await query<{ id: number }>(
      `SELECT id FROM materials WHERE id = $1 AND is_active`,
      [materialId]
    );
    if (material.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Wybrany materiał nie istnieje w katalogu." },
        { status: 400 }
      );
    }

    const result = await query<{ id: number }>(
      `WITH ins AS (
         INSERT INTO material_purchases (material_id, purchase_date, purchased_qty, unit, total_price_net)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id
       )
       INSERT INTO material_purchases_ext_info (purchase_id, buyer_name)
       SELECT id, $6 FROM ins
       RETURNING purchase_id AS id`,
      [materialId, purchaseDate, qty, unit, price, buyer]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("POST /api/materials/purchases:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — zakup nie został zapisany." },
      { status: 500 }
    );
  }
}
