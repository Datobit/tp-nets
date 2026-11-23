import { query, withTransaction, type PoolClient } from "@/lib/db";

export interface OrderOption {
  id: number;
  title: string;
  department: string | null;
  place: string | null;
  location_name: string;
  location_address: string;
}

export interface EmployeeOption {
  id: number;
  first_name: string;
  last_name: string;
  can_be_assigned: boolean;
}

export interface MaterialOption {
  id: number;
  name: string;
  base_unit: string;
}

// Etap bez logowania: autor raportu ustalany po stronie serwera
// z konta technicznego z seeda. Po dodaniu logowania zastąp tę funkcję
// odczytem użytkownika z sesji — nigdy z danych przesłanych przez klienta.
export async function getCurrentUserId(): Promise<number> {
  const res = await query<{
    id: number;
    employee_id: number | null;
    role: string;
  }>(
    "SELECT id, employee_id, role FROM users WHERE lower(email) = lower($1) AND is_active",
    ["demo@tp-nets.local"]
  );
  if (res.rows.length === 0) {
    throw new Error(
      "Brak konta technicznego demo w bazie — uruchom seed: docker compose exec -T db psql -U tp_nets -d tp_nets < db/002_seed.sql"
    );
  }
  return res.rows[0].id;
}

export async function listOrders(): Promise<OrderOption[]> {
  const res = await query<OrderOption>(`
    SELECT o.id, o.title, o.department, o.place,
           l.name AS location_name, l.address AS location_address
    FROM orders o
    JOIN locations l ON l.id = o.location_id
    WHERE o.status <> 'done'
    ORDER BY o.id DESC
  `);
  return res.rows;
}

export async function listAssignableEmployees(): Promise<EmployeeOption[]> {
  const res = await query<EmployeeOption>(
    `SELECT id, first_name, last_name, can_be_assigned
     FROM employees
     WHERE is_active AND can_be_assigned
     ORDER BY last_name, first_name`
  );
  return res.rows;
}

export async function listActiveMaterials(): Promise<MaterialOption[]> {
  const res = await query<MaterialOption>(
    `SELECT id, name, base_unit FROM materials WHERE is_active ORDER BY name`
  );
  return res.rows;
}

export interface ReportListItem {
  id: number;
  work_date: string; // YYYY-MM-DD
  order_title: string;
  location_name: string;
  description: string;
  employees: string[];
}

export async function listReports(): Promise<ReportListItem[]> {
  const res = await query<{
    id: number;
    work_date: string;
    order_title: string;
    location_name: string;
    description: string;
    employees: string[] | null;
  }>(
    `SELECT r.id,
            to_char(r.work_date, 'YYYY-MM-DD') AS work_date,
            o.title AS order_title,
            l.name AS location_name,
            r.description,
            (SELECT array_agg(e.first_name ORDER BY e.first_name)
             FROM report_employees re
             JOIN employees e ON e.id = re.employee_id
             WHERE re.work_report_id = r.id) AS employees
     FROM work_reports r
     JOIN orders o ON o.id = r.order_id
     JOIN locations l ON l.id = o.location_id
     WHERE r.deleted_at IS NULL
     ORDER BY r.work_date DESC, r.id DESC
     LIMIT 100`
  );
  return res.rows.map((row) => ({
    ...row,
    employees: row.employees ?? [],
  }));
}

export interface ReportDetail {
  id: number;
  order_id: number;
  order_title: string;
  location_name: string;
  location_address: string;
  department: string | null;
  place: string | null;
  work_date: string;
  place_details: string | null;
  description: string;
  notes: string | null;
  no_materials: boolean;
  employees: { name: string; start_time: string; end_time: string }[];
  materials: {
    name: string;
    used_qty: string;
    unit: string;
  }[];
}

/**
 * Widok listy raportów zależny od roli: szef widzi wszystkie, pracownik
 * tylko te, które utworzył lub w których uczestniczy. Ustalanie widoczności
 * po stronie serwera — ukrycie przycisku nie wystarcza.
 */
export async function listReportsForSession(session: {
  role: "worker" | "boss";
  userId: number;
  employeeId: number | null;
}): Promise<ReportListItem[]> {
  if (session.role === "boss") {
    return listReports();
  }
  const res = await query<{
    id: number;
    work_date: string;
    order_title: string;
    location_name: string;
    description: string;
    employees: string[] | null;
  }>(
    `SELECT DISTINCT r.id,
            to_char(r.work_date, 'YYYY-MM-DD') AS work_date,
            o.title AS order_title,
            l.name AS location_name,
            r.description,
            (SELECT array_agg(e2.first_name ORDER BY e2.first_name)
             FROM report_employees re
             JOIN employees e2 ON e2.id = re.employee_id
             WHERE re.work_report_id = r.id) AS employees
     FROM work_reports r
     JOIN orders o ON o.id = r.order_id
     JOIN locations l ON l.id = o.location_id
     WHERE r.created_by_user_id = $1
        OR EXISTS (
            SELECT 1 FROM report_employees re2
            WHERE re2.work_report_id = r.id AND re2.employee_id = $2
        )
       AND r.deleted_at IS NULL
     ORDER BY work_date DESC, r.id DESC
     LIMIT 100`,
    [session.userId, session.employeeId ?? -1]
  );
  return res.rows.map((row) => ({
    ...row,
    employees: row.employees ?? [],
  }));
}

/** Dostęp do szczegółów raportu: szef — wszystkie, pracownik — autor lub uczestnik. */
export async function getReportForSession(
  id: number,
  session: { role: "worker" | "boss"; userId: number; employeeId: number | null }
): Promise<ReportDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  if (session.role === "boss") {
    return getReport(id);
  }
  const allowed = await query<{ id: number }>(
    `SELECT r.id
     FROM work_reports r
     WHERE r.id = $1
       AND (r.created_by_user_id = $2
            OR EXISTS (
                SELECT 1 FROM report_employees re
                WHERE re.work_report_id = r.id AND re.employee_id = $3
            ))`,
    [id, session.userId, session.employeeId ?? -1]
  );
  if (allowed.rows.length === 0) return null; // brak dostępu = brak raportu
  return getReport(id);
}

export async function getReport(id: number): Promise<ReportDetail | null> {
  const res = await query<ReportDetail>(
    `SELECT r.id,
           r.order_id,
           o.title AS order_title,
           l.name AS location_name,
           l.address AS location_address,
           COALESCE(r.department, o.department) AS department,
           o.place,
           to_char(r.work_date, 'YYYY-MM-DD') AS work_date,
            r.place_details,
            r.description,
            r.notes,
            r.no_materials
     FROM work_reports r
     JOIN orders o ON o.id = r.order_id
     JOIN locations l ON l.id = o.location_id
     WHERE r.id = $1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  const report = res.rows[0];

  const [employees, materials] = await Promise.all([
    query<{ name: string; start_time: string; end_time: string }>(
      `SELECT (e.first_name) AS name,
              to_char(re.start_time, 'HH24:MI') AS start_time,
              to_char(re.end_time, 'HH24:MI') AS end_time
       FROM report_employees re
       JOIN employees e ON e.id = re.employee_id
       WHERE re.work_report_id = $1
       ORDER BY e.first_name`,
      [id]
    ),
    query<{ name: string; used_qty: string; unit: string }>(
      `SELECT COALESCE(m.name, rm.custom_name) AS name,
              to_char(rm.used_qty, 'FM999999990.0') AS used_qty,
              rm.unit
       FROM report_materials rm
       LEFT JOIN materials m ON m.id = rm.material_id
       WHERE rm.work_report_id = $1
       ORDER BY rm.id`,
      [id]
    ),
  ]);

  return {
    ...report,
    employees: employees.rows,
    materials: materials.rows,
  };
}

export interface SaveReportInput {
  order_id: number;
  work_date: string;
  employees: { employee_id: number; start_time: string; end_time: string }[];
  description: string;
  place_details?: string | null;
  department?: string | null;
  notes?: string | null;
  materials: { material_id: number; used_qty: number; unit?: string | null }[];
  no_materials: boolean;
}

const UNIT_MAX = 20;

function validateReport(input: SaveReportInput): string | null {
  if (!Number.isInteger(input.order_id) || input.order_id <= 0) {
    return "Wybierz zlecenie.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.work_date)) {
    return "Podaj poprawną datę pracy.";
  }
  const description = input.description?.trim() ?? "";
  if (!description) {
    return "Opis wykonanej pracy jest wymagany.";
  }
  if (
    !Array.isArray(input.employees) ||
    input.employees.length < 1 ||
    input.employees.length > 3
  ) {
    return "Wybierz od 1 do 3 monterów.";
  }
  const employeeIds = input.employees.map((e) => e.employee_id);
  if (new Set(employeeIds).size !== employeeIds.length) {
    return "Monterzy muszą być różni (bez duplikatów).";
  }
  for (const e of input.employees) {
    if (!Number.isInteger(e.employee_id) || e.employee_id <= 0) {
      return "Wybierz monterów z listy.";
    }
    if (!/^\d{2}:\d{2}$/.test(e.start_time) || !/^\d{2}:\d{2}$/.test(e.end_time)) {
      return "Godziny monterów mają format HH:MM.";
    }
    if (e.end_time <= e.start_time) {
      return "Godzina zakończenia musi być po godzinie rozpoczęcia.";
    }
  }
  if (input.no_materials && input.materials.length > 0) {
    return "Nie można jednocześnie zaznaczyć „brak materiałów” i podać pozycji.";
  }
  for (const m of input.materials) {
    if (!Number.isInteger(m.material_id) || m.material_id <= 0) {
      return "Wybierz materiał z katalogu.";
    }
    if (typeof m.used_qty !== "number" || !Number.isFinite(m.used_qty) || m.used_qty <= 0) {
      return "Ilość materiału musi być liczbą dodatnią.";
    }
    if (m.unit != null && (typeof m.unit !== "string" || m.unit.trim().length > UNIT_MAX)) {
      return `Jednostka może mieć maksymalnie ${UNIT_MAX} znaków.`;
    }
  }
  return null;
}

/**
 * Wstawia pozycje zużycia materiałów. Jednostka: podpowiedź z katalogu,
 * ale można wpisać inną (np. 0,5 paczki dla materiału w szt.) — bez
 * przelicznika aplikacja NIE sumuje pozycji w różnych jednostkach.
 * Cena: brak — koszt to osobny proces akceptacji (suggested_cost_net NULL).
 */
async function insertMaterialRows(
  tx: PoolClient,
  reportId: number,
  materials: SaveReportInput["materials"]
): Promise<void> {
  for (const m of materials) {
    await tx.query(
      `INSERT INTO report_materials (work_report_id, material_id, used_qty, unit)
       VALUES ($1, $2, $3, COALESCE(nullif(btrim($4), ''), (SELECT base_unit FROM materials WHERE id = $2)))`,
      [reportId, m.material_id, m.used_qty, m.unit ?? null]
    );
  }
}

async function insertEmployeeRows(
  tx: PoolClient,
  reportId: number,
  employees: SaveReportInput["employees"]
): Promise<void> {
  for (const e of employees) {
    await tx.query(
      `INSERT INTO report_employees (work_report_id, employee_id, start_time, end_time)
       VALUES ($1, $2, $3::time, $4::time)`,
      [reportId, e.employee_id, e.start_time, e.end_time]
    );
  }
}

/** Walidacja danych raportu wobec bazy (zlecenie, monterzy, materiały). */
async function validateAgainstDb(
  tx: PoolClient,
  input: SaveReportInput
): Promise<string | null> {
  const order = await tx.query(`SELECT id FROM orders WHERE id = $1`, [
    input.order_id,
  ]);
  if (order.rows.length === 0) {
    return "Wybrane zlecenie nie istnieje.";
  }

  const employeeIds = input.employees.map((e) => e.employee_id);
  const employees = await tx.query<{ id: number }>(
    `SELECT id FROM employees WHERE id = ANY($1::int[]) AND is_active AND can_be_assigned`,
    [employeeIds]
  );
  if (employees.rows.length !== employeeIds.length) {
    return "Wybrany monter nie istnieje lub nie może być przypisany.";
  }

  if (!input.no_materials && input.materials.length > 0) {
    const materialIds = input.materials.map((m) => m.material_id);
    const materials = await tx.query<{ id: number }>(
      `SELECT id FROM materials WHERE id = ANY($1::int[]) AND is_active`,
      [materialIds]
    );
    if (materials.rows.length !== new Set(materialIds).size) {
      return "Wybrany materiał nie istnieje w katalogu.";
    }
  }
  return null;
}

/**
 * Nowy raport. Walidacja po stronie serwera + zapis w jednej transakcji.
 * Zwraca id nowego raportu albo komunikat błędu po polsku.
 */
export async function saveReport(
  input: SaveReportInput,
  createdByUserId: number
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const invalid = validateReport(input);
  if (invalid) return { ok: false, error: invalid };

  try {
    return await withTransaction(async (tx) => {
      const dbInvalid = await validateAgainstDb(tx, input);
      if (dbInvalid) return { ok: false as const, error: dbInvalid };

      const inserted = await tx.query<{ id: number }>(
        `INSERT INTO work_reports (order_id, created_by_user_id, work_date, place_details, department, description, notes, no_materials)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          input.order_id,
          createdByUserId,
          input.work_date,
          input.place_details?.trim() || null,
          input.department?.trim() || null,
          input.description.trim(),
          input.notes?.trim() || null,
          input.no_materials,
        ]
      );
      const reportId = inserted.rows[0].id;

      await insertEmployeeRows(tx, reportId, input.employees);
      if (!input.no_materials) {
        await insertMaterialRows(tx, reportId, input.materials);
      }

      return { ok: true as const, id: reportId };
    });
  } catch (err) {
    console.error("Błąd zapisu raportu:", err);
    return { ok: false, error: "Nie udało się zapisać raportu. Spróbuj ponownie." };
  }
}

/** Zmiany w nagłówku raportu (edycja): co wolne do nadpisania. */
export interface UpdateReportInput {
  work_date: string;
  employees: { employee_id: number; start_time: string; end_time: string }[];
  description: string;
  place_details?: string | null;
  department?: string | null;
  notes?: string | null;
  materials: SaveReportInput["materials"];
  no_materials: boolean;
}

/**
 * Edycja raportu: TYLKO autor i tylko dopóki raport nie jest usunięty.
 * Monter dopisany do raportu NIE ma prawa edycji (sprawdzenie po userId
 * z sesji, po stronie serwera). Zlecenie raportu nie podlega zmianie —
 * raport należy do zlecenia; treść robocza (data, godziny, miejsce, uwagi,
 * materiały) może być poprawiona przez autora.
 */
export async function updateReport(
  reportId: number,
  session: { role: "worker" | "boss"; userId: number },
  input: UpdateReportInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return { ok: false, error: "Nieprawidłowy raport." };
  }
  const shared: SaveReportInput = {
    order_id: 0, // nieużywane w validateReport dla edycji — patrz niżej
    ...input,
  } as SaveReportInput;
  // Walidacja treści (bez order_id — przy edycji zlecenie jest stałe).
  const orderIndependent = validateReport({ ...shared, order_id: 1 });
  if (orderIndependent) return { ok: false, error: orderIndependent };

  try {
    return await withTransaction(async (tx) => {
      const current = await tx.query<{ id: number; order_id: number; created_by_user_id: number; deleted_at: Date | null }>(
        `SELECT id, order_id, created_by_user_id, deleted_at
         FROM work_reports WHERE id = $1`,
        [reportId]
      );
      if (current.rows.length === 0) {
        return { ok: false as const, error: "Raport nie istnieje." };
      }
      const report = current.rows[0];
      if (report.deleted_at !== null) {
        return {
          ok: false as const,
          error: "Raport jest usunięty — najpierw przywróć go.",
        };
      }
      if (report.created_by_user_id !== session.userId) {
        return {
          ok: false as const,
          error: "Tylko autor raportu może go edytować.",
        };
      }

      // Walidacja danych wobec bazy (monterzy, materiały) — z prawdziwym order_id.
      const inputForDb: SaveReportInput = { ...shared, order_id: report.order_id };
      const dbInvalid = await validateAgainstDb(tx, inputForDb);
      if (dbInvalid) return { ok: false as const, error: dbInvalid };

      await tx.query(
        `UPDATE work_reports
         SET work_date = $1, place_details = $2, department = $3,
             description = $4, notes = $5, no_materials = $6,
             updated_at = now()
         WHERE id = $7`,
        [
          input.work_date,
          input.place_details?.trim() || null,
          input.department?.trim() || null,
          input.description.trim(),
          input.notes?.trim() || null,
          input.no_materials,
          reportId,
        ]
      );

      await tx.query(`DELETE FROM report_employees WHERE work_report_id = $1`, [reportId]);
      await insertEmployeeRows(tx, reportId, input.employees);

      await tx.query(`DELETE FROM report_materials WHERE work_report_id = $1`, [reportId]);
      if (!input.no_materials) {
        await insertMaterialRows(tx, reportId, input.materials);
      }

      return { ok: true as const };
    });
  } catch (err) {
    console.error("updateReport:", err);
    return { ok: false, error: "Nie udało się zapisać zmian raportu." };
  }
}

/**
 * Usunięcie raportu: TYLKO autor (szef nie usuwa cudzych). TRWAŁE —
 * usuwa raport razem z pozycjami zużycia materiałów i przypisaniami
 * monterów. Zlecenie, katalog materiałów i zakupy zostają nietknięte.
 * Stary link do raportu zwraca potem 404 (brak wiersza).
 */
export async function deleteReport(
  reportId: number,
  session: { role: "worker" | "boss"; userId: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return { ok: false, error: "Nieprawidłowy raport." };
  }
  try {
    return await withTransaction(async (tx) => {
      const current = await tx.query<{ created_by_user_id: number }>(
        `SELECT created_by_user_id FROM work_reports WHERE id = $1`,
        [reportId]
      );
      if (current.rows.length === 0) {
        return { ok: false as const, error: "Raport nie istnieje." };
      }
      if (current.rows[0].created_by_user_id !== session.userId) {
        return {
          ok: false as const,
          error: "Tylko autor raportu może go usunąć.",
        };
      }

      // Pozycje i przypisania first (FK bez CASCADE), potem sam raport.
      await tx.query(`DELETE FROM report_materials WHERE work_report_id = $1`, [reportId]);
      await tx.query(`DELETE FROM report_employees WHERE work_report_id = $1`, [reportId]);
      await tx.query(`DELETE FROM work_reports WHERE id = $1`, [reportId]);

      return { ok: true as const };
    });
  } catch (err) {
    console.error("deleteReport:", err);
    return { ok: false, error: "Nie udało się usunąć raportu." };
  }
}

// --- Widok szefa: Obiekt → Zlecający → Zlecenia → Raporty ---

export interface BossLocation {
  id: number;
  name: string;
  address: string;
  reports_count: number;
}

export interface BossContact {
  id: number;
  full_name: string;
  location_id: number;
  reports_count: number;
}

export interface BossOrder {
  id: number;
  order_number: string;
  title: string;
  status: "new" | "in_progress" | "done";
  reports_count: number;
}

export interface BossReportItem {
  id: number;
  work_date: string;
  description: string;
  employees: string[];
  author: string | null;
}

export async function listBossLocations(): Promise<BossLocation[]> {
  const res = await query<BossLocation>(
    `SELECT l.id, l.name, l.address,
            (SELECT count(*) FROM work_reports r
             JOIN orders o ON o.id = r.order_id
             WHERE o.location_id = l.id AND r.deleted_at IS NULL) AS reports_count
     FROM locations l
     ORDER BY l.name`
  );
  return res.rows.map((r) => ({ ...r, reports_count: Number(r.reports_count) }));
}

/** Zlecający danego obiektu (kontakty) z liczbą raportów ich zleceń. */
export async function listBossContacts(locationId: number): Promise<BossContact[]> {
  const res = await query<BossContact>(
    `SELECT c.id, c.full_name, c.location_id,
            (SELECT count(*) FROM work_reports r
             JOIN orders o ON o.id = r.order_id
             WHERE o.requested_by_contact_id = c.id AND r.deleted_at IS NULL) AS reports_count
     FROM location_contacts c
     WHERE c.location_id = $1
     ORDER BY c.full_name`,
    [locationId]
  );
  return res.rows.map((r) => ({ ...r, reports_count: Number(r.reports_count) }));
}

/** Zlecenia danego zlecającego: AKTYWNE i ZAMKNIĘTE (historia bez strat). */
export async function listBossOrders(contactId: number): Promise<BossOrder[]> {
  const res = await query<BossOrder>(
    `SELECT o.id, o.order_number, o.title, o.status,
            (SELECT count(*) FROM work_reports r
             WHERE r.order_id = o.id AND r.deleted_at IS NULL) AS reports_count
     FROM orders o
     WHERE o.requested_by_contact_id = $1
     ORDER BY (o.status = 'done'), o.id DESC`,
    [contactId]
  );
  return res.rows.map((r) => ({ ...r, reports_count: Number(r.reports_count) }));
}

/** Raporty zlecenia. */
export async function listBossReports(orderId: number): Promise<BossReportItem[]> {
  const res = await query<{
    id: number;
    work_date: string;
    description: string;
    employees: string[] | null;
    author: string | null;
  }>(
    `SELECT r.id,
            to_char(r.work_date, 'YYYY-MM-DD') AS work_date,
            r.description,
            (SELECT array_agg(e.first_name ORDER BY e.first_name)
             FROM report_employees re
             JOIN employees e ON e.id = re.employee_id
             WHERE re.work_report_id = r.id) AS employees,
            u.email AS author
     FROM work_reports r
     LEFT JOIN users u ON u.id = r.created_by_user_id
     WHERE r.order_id = $1
     ORDER BY r.work_date DESC, r.id DESC`,
    [orderId]
  );
  return res.rows.map((row) => ({
    ...row,
    employees: row.employees ?? [],
  }));
}

/**
 * „Do przypisania”: raporty, których zlecenie NIE MA pewnego powiązania
 * z osobą zlecającą (stare zlecenia przed wprowadzeniem kontaktów).
 * Bez zgadywania — nic nie jest dopasowywane automatycznie.
 */
export async function listUnassignedReports(): Promise<BossReportItem[]> {
  const res = await query<{
    id: number;
    work_date: string;
    description: string;
    employees: string[] | null;
    author: string | null;
  }>(
    `SELECT r.id,
            to_char(r.work_date, 'YYYY-MM-DD') AS work_date,
            r.description,
            (SELECT array_agg(e.first_name ORDER BY e.first_name)
             FROM report_employees re
             JOIN employees e ON e.id = re.employee_id
             WHERE re.work_report_id = r.id) AS employees,
            u.email AS author
     FROM work_reports r
     JOIN orders o ON o.id = r.order_id
     LEFT JOIN users u ON u.id = r.created_by_user_id
     WHERE o.requested_by_contact_id IS NULL AND r.deleted_at IS NULL
     ORDER BY r.work_date DESC, r.id DESC
     LIMIT 200`
  );
  return res.rows.map((row) => ({
    ...row,
    employees: row.employees ?? [],
  }));
}
