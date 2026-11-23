import { query, withTransaction } from "@/lib/db";

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
            (SELECT array_agg(e.last_name || ' ' || e.first_name ORDER BY e.last_name, e.first_name)
             FROM report_employees re
             JOIN employees e ON e.id = re.employee_id
             WHERE re.work_report_id = r.id) AS employees
     FROM work_reports r
     JOIN orders o ON o.id = r.order_id
     JOIN locations l ON l.id = o.location_id
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
            (SELECT array_agg(e2.last_name || ' ' || e2.first_name ORDER BY e2.last_name, e2.first_name)
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
      `SELECT (e.last_name || ' ' || e.first_name) AS name,
              to_char(re.start_time, 'HH24:MI') AS start_time,
              to_char(re.end_time, 'HH24:MI') AS end_time
       FROM report_employees re
       JOIN employees e ON e.id = re.employee_id
       WHERE re.work_report_id = $1
       ORDER BY e.last_name, e.first_name`,
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
  materials: { material_id: number; used_qty: number }[];
  no_materials: boolean;
}

/**
 * Walidacja po stronie serwera + zapis w jednej transakcji.
 * Zwraca id nowego raportu albo komunikat błędu po polsku.
 */
export async function saveReport(
  input: SaveReportInput,
  createdByUserId: number
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  // --- walidacja serwerowa ---
  if (!Number.isInteger(input.order_id) || input.order_id <= 0) {
    return { ok: false, error: "Wybierz zlecenie." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.work_date)) {
    return { ok: false, error: "Podaj poprawną datę pracy." };
  }
  const description = input.description?.trim() ?? "";
  if (!description) {
    return { ok: false, error: "Opis wykonanej pracy jest wymagany." };
  }
  if (
    !Array.isArray(input.employees) ||
    input.employees.length < 1 ||
    input.employees.length > 3
  ) {
    return {
      ok: false,
      error: "Wybierz od 1 do 3 monterów.",
    };
  }
  const employeeIds = input.employees.map((e) => e.employee_id);
  if (new Set(employeeIds).size !== employeeIds.length) {
    return { ok: false, error: "Monterzy muszą być różni (bez duplikatów)." };
  }
  for (const e of input.employees) {
    if (!Number.isInteger(e.employee_id) || e.employee_id <= 0) {
      return { ok: false, error: "Wybierz monterów z listy." };
    }
    if (!/^\d{2}:\d{2}$/.test(e.start_time) || !/^\d{2}:\d{2}$/.test(e.end_time)) {
      return { ok: false, error: "Godziny monterów mają format HH:MM." };
    }
    if (e.end_time <= e.start_time) {
      return { ok: false, error: "Godzina zakończenia musi być po godzinie rozpoczęcia." };
    }
  }
  if (input.no_materials && input.materials.length > 0) {
    return {
      ok: false,
      error: "Nie można jednocześnie zaznaczyć „brak materiałów” i podać pozycje.",
    };
  }
  for (const m of input.materials) {
    if (!Number.isInteger(m.material_id) || m.material_id <= 0) {
      return { ok: false, error: "Wybierz materiał z katalogu." };
    }
    if (typeof m.used_qty !== "number" || !Number.isFinite(m.used_qty) || m.used_qty <= 0) {
      return { ok: false, error: "Ilość materiału musi być liczbą dodatnią." };
    }
  }

  // --- transakcja ---
  try {
    return await withTransaction(async (tx) => {
      const order = await tx.query(`SELECT id FROM orders WHERE id = $1`, [
        input.order_id,
      ]);
      if (order.rows.length === 0) {
        return { ok: false as const, error: "Wybrane zlecenie nie istnieje." };
      }

      const employees = await tx.query<{ id: number }>(
        `SELECT id FROM employees WHERE id = ANY($1::int[]) AND is_active AND can_be_assigned`,
        [employeeIds]
      );
      if (employees.rows.length !== employeeIds.length) {
        return {
          ok: false as const,
          error: "Wybrany monter nie istnieje lub nie może być przypisany.",
        };
      }

      if (!input.no_materials && input.materials.length > 0) {
        const materialIds = input.materials.map((m) => m.material_id);
        const materials = await tx.query<{ id: number }>(
          `SELECT id FROM materials WHERE id = ANY($1::int[]) AND is_active`,
          [materialIds]
        );
        if (materials.rows.length !== new Set(materialIds).size) {
          return {
            ok: false as const,
            error: "Wybrany materiał nie istnieje w katalogu.",
          };
        }
      }

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
          description,
          input.notes?.trim() || null,
          input.no_materials,
        ]
      );
      const reportId = inserted.rows[0].id;

      for (const e of input.employees) {
        await tx.query(
          `INSERT INTO report_employees (work_report_id, employee_id, start_time, end_time)
           VALUES ($1, $2, $3::time, $4::time)`,
          [reportId, e.employee_id, e.start_time, e.end_time]
        );
      }

      if (!input.no_materials) {
        for (const m of input.materials) {
          await tx.query(
            `INSERT INTO report_materials (work_report_id, material_id, used_qty, unit)
             VALUES ($1, $2, $3, (SELECT base_unit FROM materials WHERE id = $2))`,
            [reportId, m.material_id, m.used_qty]
          );
        }
      }

      return { ok: true as const, id: reportId };
    });
  } catch (err) {
    console.error("Błąd zapisu raportu:", err);
    return { ok: false, error: "Nie udało się zapisać raportu. Spróbuj ponownie." };
  }
}
