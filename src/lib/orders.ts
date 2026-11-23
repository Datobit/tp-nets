import { query } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export interface OrderListItem {
  id: number;
  title: string;
  department: string | null;
  place: string | null;
  status: "new" | "in_progress" | "done";
  location_name: string;
  location_address: string;
}

/** Aktywne zlecenia (do selektora nowego raportu). */
export async function listActiveOrders(): Promise<
  { id: number; title: string; department: string | null }[]
> {
  const res = await query<{
    id: number;
    title: string;
    department: string | null;
  }>(
    `SELECT o.id, o.title, o.department
     FROM orders o
     WHERE o.status <> 'done'
     ORDER BY o.id DESC`
  );
  return res.rows;
}

/** Wszystkie zlecenia — historia (ekran Zlecenia). */
export async function listOrdersForView(): Promise<OrderListItem[]> {
  const res = await query<OrderListItem>(
    `SELECT o.id, o.title, o.department, o.place, o.status,
            l.name AS location_name, l.address AS location_address
     FROM orders o
     JOIN locations l ON l.id = o.location_id
     ORDER BY o.status <> 'done' DESC, o.id DESC`
  );
  return res.rows;
}

/**
 * Nowe zlecenie. Monter i szef mogą dodawać; walidacja serwerowa.
 * Obiekt: wybor z listy LUB jawne utworzenie nowego (nazwa wymagana,
 * adres opcjonalny) — nigdy ciche przypisanie do obiektu demo.
 */
export async function createOrder(
  session: SessionUser,
  input: {
    title: string;
    location_id: number | null;
    new_location: { name: string; address: string | null } | null;
  }
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const title = input.title?.trim() ?? "";
  if (!title) {
    return { ok: false, error: "Nazwa zlecenia jest wymagana." };
  }
  if (title.length > 200) {
    return { ok: false, error: "Nazwa zlecenia jest zbyt długa (max 200 znaków)." };
  }

  let locationId: number;
  if (input.new_location && input.new_location.name?.trim()) {
    // jawne utworzenie nowego obiektu (adres opcjonalny)
    const name = input.new_location.name.trim().slice(0, 200);
    const address = input.new_location.address?.trim() || "(adres do uzupełnienia)";
    const ins = await query<{ id: number }>(
      `INSERT INTO locations (name, address) VALUES ($1, $2) RETURNING id`,
      [name, address.slice(0, 300)]
    );
    locationId = ins.rows[0].id;
  } else {
    const locId = Number(input.location_id);
    if (!Number.isInteger(locId) || locId <= 0) {
      return { ok: false, error: "Wybierz obiekt lub podaj nowy." };
    }
    const loc = await query<{ id: number }>(
      `SELECT id FROM locations WHERE id = $1`,
      [locId]
    );
    if (loc.rows.length === 0) {
      return { ok: false, error: "Wybrany obiekt nie istnieje." };
    }
    locationId = locId;
  }

  const res = await query<{ id: number }>(
    `INSERT INTO orders (location_id, title, status)
     VALUES ($1, $2, 'new')
     RETURNING id`,
    [locationId, title]
  );
  return { ok: true, id: res.rows[0].id };
}

/** Zmiana nazwy — tylko szef (rola sprawdzana serwerowo). */
export async function renameOrder(
  session: SessionUser,
  orderId: number,
  title: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.role !== "boss") {
    return { ok: false, error: "Tylko szef może zmieniać nazwy zleceń." };
  }
  const clean = title?.trim() ?? "";
  if (!clean) {
    return { ok: false, error: "Nazwa zlecenia jest wymagana." };
  }
  const res = await query<{ id: number }>(
    `UPDATE orders SET title = $1 WHERE id = $2 RETURNING id`,
    [clean, orderId]
  );
  if (res.rows.length === 0) {
    return { ok: false, error: "Zlecenie nie istnieje." };
  }
  return { ok: true };
}

/** Zamknięcie zlecenia — tylko szef. Zamknięte znika z selektora nowych raportów. */
export async function closeOrder(
  session: SessionUser,
  orderId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.role !== "boss") {
    return { ok: false, error: "Tylko szef może zamykać zlecenia." };
  }
  const res = await query<{ id: number }>(
    `UPDATE orders SET status = 'done' WHERE id = $1 AND status <> 'done' RETURNING id`,
    [orderId]
  );
  if (res.rows.length === 0) {
    return {
      ok: false,
      error: "Zlecenie nie istnieje lub jest już zamknięte.",
    };
  }
  return { ok: true };
}
