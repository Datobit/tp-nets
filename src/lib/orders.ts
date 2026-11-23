import { query, withTransaction } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export interface OrderListItem {
  id: number;
  order_number: string;
  title: string;
  department: string | null;
  place: string | null;
  status: "new" | "in_progress" | "done";
  location_name: string;
  location_address: string;
  requested_by: string | null;
  reports_count: number;
}

export interface ContactOption {
  id: number;
  location_id: number;
  full_name: string;
  phone: string | null;
}

/** Aktywne zlecenia (do selektora nowego raportu) — zamknięte poza wyborem. */
export async function listActiveOrders(): Promise<
  { id: number; order_number: string; title: string; department: string | null }[]
> {
  const res = await query<{
    id: number;
    order_number: string;
    title: string;
    department: string | null;
  }>(
    `SELECT o.id, o.order_number, o.title, o.department
     FROM orders o
     WHERE o.status <> 'done'
     ORDER BY o.id DESC`
  );
  return res.rows;
}

/** Wszystkie zlecenia — historia (ekran Zlecenia). */
export async function listOrdersForView(): Promise<OrderListItem[]> {
  const res = await query<OrderListItem>(
    `SELECT o.id,
            o.order_number,
            o.title,
            o.department,
            o.place,
            o.status,
            l.name AS location_name,
            l.address AS location_address,
            c.full_name AS requested_by,
            (SELECT count(*) FROM work_reports r
             WHERE r.order_id = o.id AND r.deleted_at IS NULL) AS reports_count
     FROM orders o
     JOIN locations l ON l.id = o.location_id
     LEFT JOIN location_contacts c ON c.id = o.requested_by_contact_id
     ORDER BY o.status <> 'done' DESC, o.id DESC`
  );
  return res.rows;
}

export interface LocationOption {
  id: number;
  name: string;
  address: string;
}

export async function listLocations(): Promise<LocationOption[]> {
  const res = await query<LocationOption>(
    `SELECT id, name, address FROM locations ORDER BY name`
  );
  return res.rows;
}

export async function listActiveContacts(): Promise<ContactOption[]> {
  const res = await query<ContactOption>(
    `SELECT id, location_id, full_name, phone
     FROM location_contacts
     WHERE is_active
     ORDER BY location_id, full_name`
  );
  return res.rows;
}

export interface SaveOrderInput {
  title: string;
  location_id: number;
  requested_by_contact_id: number | null;
  department?: string | null;
  place?: string | null;
}

function validateCommon(input: SaveOrderInput): string | null {
  const title = input.title?.trim() ?? "";
  if (!title) return "Tytuł zlecenia jest wymagany.";
  if (title.length > 200) return "Tytuł zlecenia jest zbyt długi (max 200 znaków).";
  if (!Number.isInteger(input.location_id) || input.location_id <= 0) {
    return "Wybierz obiekt.";
  }
  if (
    input.requested_by_contact_id !== null &&
    (!Number.isInteger(input.requested_by_contact_id) ||
      input.requested_by_contact_id <= 0)
  ) {
    return "Wybierz osobę zlecającą z kontaktów obiektu.";
  }
  return null;
}

/**
 * Nowe zlecenie. Pracownik i szef. Numer nadaje sekwencja; wymagane:
 * obiekt, osoba zlecająca (kontakt WYBRANEGO obiektu), tytuł.
 */
export async function createOrder(
  session: SessionUser,
  input: SaveOrderInput
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const invalid = validateCommon(input);
  if (invalid) return { ok: false, error: invalid };

  try {
    return await withTransaction(async (tx) => {
      const loc = await tx.query<{ id: number }>(
        `SELECT id FROM locations WHERE id = $1`,
        [input.location_id]
      );
      if (loc.rows.length === 0) {
        return { ok: false as const, error: "Wybrany obiekt nie istnieje." };
      }

      // Zlecający musi być kontaktem TEGO obiektu (nie dowolnym kontaktem).
      const contact = await tx.query<{ id: number }>(
        `SELECT id FROM location_contacts
         WHERE id = $1 AND location_id = $2 AND is_active`,
        [input.requested_by_contact_id, input.location_id]
      );
      if (contact.rows.length === 0) {
        return {
          ok: false as const,
          error: "Osoba zlecająca musi być kontaktem wybranego obiektu.",
        };
      }

      // Numer: ZR/<rok>/<kolejny z sekwencji>. Kolizja teoretycznie niemożliwa
      // (sekwencja), ale uniq index to definitywnie zabezpiecza.
      const year = new Date().getFullYear();
      const seq = await tx.query<{ nextval: string }>(
        `SELECT nextval('order_number_seq') AS nextval`
      );
      const orderNumber = `ZR/${year}/${String(seq.rows[0].nextval).padStart(4, "0")}`;

      const res = await tx.query<{ id: number }>(
        `INSERT INTO orders (location_id, title, status, requested_by_contact_id, order_number)
         VALUES ($1, $2, 'new', $3, $4)
         RETURNING id`,
        [input.location_id, input.title.trim(), input.requested_by_contact_id, orderNumber]
      );
      return { ok: true as const, id: res.rows[0].id };
    });
  } catch (err) {
    console.error("createOrder:", err);
    return { ok: false, error: "Nie udało się dodać zlecenia. Spróbuj ponownie." };
  }
}

/**
 * Edycja zlecenia. Tytuł/dział/miejsce: pracownik i szef.
 * Obiekt i zlecający: TYLKO szef, gdy zlecenie ma jakiekolwiek raporty
 * (nienależone) — zmiana obiektu przeniosłaby historię do innego obiektu.
 */
export async function updateOrder(
  session: SessionUser,
  orderId: number,
  input: SaveOrderInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const invalid = validateCommon(input);
  if (invalid) return { ok: false, error: invalid };

  try {
    return await withTransaction(async (tx) => {
      const current = await tx.query<{
        id: number;
        location_id: number;
        requested_by_contact_id: number | null;
      }>(`SELECT id, location_id, requested_by_contact_id FROM orders WHERE id = $1`, [
        orderId,
      ]);
      if (current.rows.length === 0) {
        return { ok: false as const, error: "Zlecenie nie istnieje." };
      }
      const existing = current.rows[0];

      const contact = await tx.query<{ id: number }>(
        `SELECT id FROM location_contacts
         WHERE id = $1 AND location_id = $2 AND is_active`,
        [input.requested_by_contact_id, input.location_id]
      );
      if (contact.rows.length === 0) {
        return {
          ok: false as const,
          error: "Osoba zlecająca musi być kontaktem wybranego obiektu.",
        };
      }

      const locationChanged = existing.location_id !== input.location_id;
      const contactChanged =
        existing.requested_by_contact_id !== input.requested_by_contact_id;

      if ((locationChanged || contactChanged) && session.role !== "boss") {
        const reports = await tx.query<{ count: string }>(
          `SELECT count(*) AS count FROM work_reports
           WHERE order_id = $1 AND deleted_at IS NULL`,
          [orderId]
        );
        if (Number(reports.rows[0].count) > 0) {
          return {
            ok: false as const,
            error:
              "Zlecenie ma raporty — zmiana obiektu lub zlecającego należy do szefa.",
          };
        }
      }

      await tx.query(
        `UPDATE orders
         SET title = $1, location_id = $2, requested_by_contact_id = $3
         WHERE id = $4`,
        [input.title.trim(), input.location_id, input.requested_by_contact_id, orderId]
      );
      return { ok: true as const };
    });
  } catch (err) {
    console.error("updateOrder:", err);
    return { ok: false, error: "Nie udało się zapisać zmian zlecenia." };
  }
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

/** Szczegóły zlecenia do edycji (forma options + obecne wartości). */
export async function getOrderForEdit(orderId: number): Promise<{
  id: number;
  order_number: string;
  title: string;
  location_id: number;
  requested_by_contact_id: number | null;
  status: string;
  reports_count: number;
} | null> {
  const res = await query<{
    id: number;
    order_number: string;
    title: string;
    location_id: number;
    requested_by_contact_id: number | null;
    status: string;
    reports_count: string;
  }>(
    `SELECT o.id, o.order_number, o.title, o.location_id,
            o.requested_by_contact_id, o.status,
            (SELECT count(*) FROM work_reports r
             WHERE r.order_id = o.id AND r.deleted_at IS NULL) AS reports_count
     FROM orders o WHERE o.id = $1`,
    [orderId]
  );
  if (res.rows.length === 0) return null;
  return { ...res.rows[0], reports_count: Number(res.rows[0].reports_count) };
}
