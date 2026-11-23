import { query, withTransaction } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export interface EmployeeBasic {
  id: number;
  first_name: string;
  last_name: string;
}

/**
 * Wyświetlana nazwa pracownika. Osoby dodane w etapie demonstracyjnym mają
 * techniczne nazwisko „Demo” w bazie — interfejs pokazuje wtedy samo imię.
 * Właściwa korekta nazwisk nastąpi migracją danych (bez zmiany kont).
 */
export function displayName(e: { first_name: string; last_name: string }) {
  return e.last_name === "Demo" ? e.first_name : e.first_name;
}

const TECHNICAL_EXCLUDE = `NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.employee_id = employees.id AND u.role = 'technical'
)`;

/**
 * Pracownicy do wyboru: szef widzi wszystkich aktywnych (składa za kogokolwiek
 * w granicach demo), pracownik — samo siebie. Wybór i tak jest wymuszany
 * serwerowo w createLeaveRequestForSession.
 */
export async function listEmployeesForSession(
  session: SessionUser
): Promise<EmployeeBasic[]> {
  if (session.role === "boss") {
    const res = await query<EmployeeBasic>(
      `SELECT id, first_name, last_name
       FROM employees
       WHERE is_active AND ${TECHNICAL_EXCLUDE}
       ORDER BY last_name, first_name`
    );
    return res.rows;
  }
  const res = await query<EmployeeBasic>(
    `SELECT id, first_name, last_name
     FROM employees
     WHERE id = $1 AND is_active`,
    [session.employeeId ?? -1]
  );
  return res.rows;
}

export interface LeaveListItem {
  id: number;
  employee_id: number;
  employee_name: string;
  start_date: string; // YYYY-MM-DD (min z dni)
  end_date: string; // YYYY-MM-DD (max z dni)
  dates: string[]; // dokładne dni wniosku — może być nieciągłe
  note: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null; // ISO
}

/**
 * Lista wniosków: szef widzi wszystkie (z uwagami), pracownik tylko własne.
 * Uwagi pracowników inni pracownicy widzieć nie mogą — pracownik dostaje
 * wyłącznie swoje rekordy, więc kwestia cudzych uwag nie istnieje.
 */
export async function listLeaveRequestsForSession(
  session: SessionUser
): Promise<LeaveListItem[]> {
  const res = await query<LeaveListItem>(
    `SELECT lr.id,
            lr.employee_id,
            CASE WHEN e.last_name = 'Demo' THEN e.first_name
                 ELSE e.last_name || ' ' || e.first_name END AS employee_name,
            to_char(lr.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(lr.end_date, 'YYYY-MM-DD') AS end_date,
            (SELECT array_agg(to_char(d.leave_date, 'YYYY-MM-DD') ORDER BY d.leave_date)
             FROM leave_request_dates d
             WHERE d.leave_request_id = lr.id) AS dates,
            CASE WHEN $1 = 'boss' OR lr.employee_id = $2 THEN lr.note END AS note,
            lr.status,
            to_char(lr.reviewed_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS reviewed_at
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     WHERE ($1 = 'boss' OR lr.employee_id = $2)
     ORDER BY lr.start_date DESC, lr.id DESC`,
    [session.role, session.employeeId ?? -1]
  );
  return res.rows.map((row) => ({ ...row, dates: row.dates ?? [] }));
}

export interface CalendarLeave {
  id: number;
  employee_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

/** Zatwierdzone urlopy nachodzące na [monthStart, monthEnd] — wspólny kalendarz. */
export async function listApprovedLeavesForMonth(
  monthStart: string,
  monthEnd: string
): Promise<CalendarLeave[]> {
  const res = await query<CalendarLeave>(
    `SELECT lr.id,
            CASE WHEN e.last_name = 'Demo' THEN e.first_name
                 ELSE e.last_name || ' ' || e.first_name END AS employee_name,
            to_char(lr.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(lr.end_date, 'YYYY-MM-DD') AS end_date
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     WHERE lr.status = 'approved'
       AND lr.start_date <= $2::date
       AND lr.end_date >= $1::date
     ORDER BY lr.start_date, lr.id`,
    [monthStart, monthEnd]
  );
  return res.rows;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalizuje listę dat: unikalne, sortowane, poprawne YYYY-MM-DD. */
function normalizeDates(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const dates = Array.from(
    new Set(raw.map((d) => String(d)).filter((d) => DATE_RE.test(d)))
  ).sort();
  return dates.length > 0 ? dates : null;
}

/**
 * Zapisuje dni wniosku (leave_request_dates) i spójne min/max w nagłówku.
 * Klient (klient = formularz) przekazuje dokładne dni; brak daty = błąd.
 */
async function writeLeaveDates(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  leaveId: number,
  dates: string[]
): Promise<void> {
  await client.query(`DELETE FROM leave_request_dates WHERE leave_request_id = $1`, [
    leaveId,
  ]);
  for (const d of dates) {
    await client.query(
      `INSERT INTO leave_request_dates (leave_request_id, leave_date)
       VALUES ($1, $2::date) ON CONFLICT DO NOTHING`,
      [leaveId, d]
    );
  }
  await client.query(
    `UPDATE leave_requests
     SET start_date = (SELECT min(leave_date) FROM leave_request_dates WHERE leave_request_id = $1),
         end_date = (SELECT max(leave_date) FROM leave_request_dates WHERE leave_request_id = $1)
     WHERE id = $1`,
    [leaveId]
  );
}

/** Sprawdza kolizje: aktywne wnioski (pending/approved) na którejkolwiek z dat. */
async function findDateConflict(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { id: number }[] }> },
  employeeId: number,
  dates: string[],
  excludeLeaveId?: number
): Promise<number | null> {
  const res = await client.query(
    `SELECT lr.id
     FROM leave_requests lr
     JOIN leave_request_dates d ON d.leave_request_id = lr.id
     WHERE lr.employee_id = $1
       AND lr.status IN ('pending', 'approved')
       AND d.leave_date = ANY($2::date[])
       AND ($3::int IS NULL OR lr.id <> $3::int)
     LIMIT 1`,
    [employeeId, dates, excludeLeaveId ?? null]
  );
  return res.rows.length > 0 ? res.rows[0].id : null;
}

/**
 * Nowy wniosek. Pracownik (worker) ZAWSZE za siebie — employee_id z sesji,
 * wysłany przez klienta identyfikator jest ignorowany. Szef może złożyć
 * za wskazanego pracownika. Autor = pracownik powiązany z kontem z sesji.
 * Daty: DOKŁADNA lista dni (nieciągła dozwolona) — 2 i 4 grudnia bez 3-go
 * to jeden wniosek z dwiema datami.
 */
export async function createLeaveRequestForSession(
  session: SessionUser,
  input: {
    employee_id: number;
    dates?: unknown;
    start_date?: string;
    end_date?: string;
    note?: string | null;
  }
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  // Kompatybilność: stare formularze wysyłają start_date/end_date.
  const dates = input.dates
    ? normalizeDates(input.dates)
    : input.start_date && input.end_date && DATE_RE.test(input.start_date) && DATE_RE.test(input.end_date)
      ? eachDay(input.start_date, input.end_date)
      : null;
  if (!dates) {
    return { ok: false, error: "Wybierz przynajmniej jeden dzień urlopu." };
  }
  const note = input.note?.trim() || null;

  let employeeId: number;
  if (session.role === "worker") {
    if (!session.employeeId) {
      return {
        ok: false,
        error:
          "Konto nie jest powiązane z pracownikiem — skontaktuj się z administratorem.",
      };
    }
    employeeId = session.employeeId; // z sesji, nie z formularza
  } else {
    employeeId = Number(input.employee_id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return { ok: false, error: "Wybierz pracownika." };
    }
  }

  try {
    return await withTransaction(async (tx) => {
      const employee = await tx.query(
        `SELECT id FROM employees WHERE id = $1 AND is_active`,
        [employeeId]
      );
      if (employee.rows.length === 0) {
        return { ok: false as const, error: "Wybrany pracownik nie istnieje." };
      }

      // Blokada drugiego AKTYWNEGO wniosku (pending/approved) na którejkolwiek
      // z wybranych dat. Odrzucony wniosek nie blokuje ponownego złożenia.
      const conflict = await findDateConflict(tx, employeeId, dates);
      if (conflict !== null) {
        return {
          ok: false as const,
          error:
            "Ten pracownik ma już aktywny wniosek obejmujący wybrane dni.",
        };
      }

      const res = await tx.query<{ id: number }>(
        `INSERT INTO leave_requests (employee_id, start_date, end_date, note)
         VALUES ($1, $2::date, $3::date, $4)
         RETURNING id`,
        [employeeId, dates[0], dates[dates.length - 1], note]
      );
      const leaveId = res.rows[0].id;
      await writeLeaveDates(tx, leaveId, dates);
      return { ok: true as const, id: leaveId };
    });
  } catch (err) {
    console.error("createLeaveRequestForSession:", err);
    return { ok: false, error: "Nie udało się zapisać wniosku. Spróbuj ponownie." };
  }
}

/** Kolejne dni zakresu [start, end] włącznie (format YYYY-MM-DD, UTC). */
function eachDay(start: string, end: string): string[] {
  if (end < start) return [];
  const out: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const stop = new Date(end + "T00:00:00Z");
  while (cur <= stop && out.length < 366) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Edycja wniosku: TYLKO autor (pracownik w roli worker za siebie, szef
 * może poprawić każdy) i TYLKO dopóki wniosek jest oczekujący. Zatwierdzony
 * wniosek NIE podlega edycji — nawet jeśli szef zatwierdzi go w trakcie
 * edycji pracownika: sprawdzanie stanu następuje w transakcji zapisu,
 * więc ostatni stan decyduje (update warunkowy WHERE status='pending').
 */
export async function updateLeaveRequestForSession(
  session: SessionUser,
  input: {
    id: number;
    dates?: unknown;
    start_date?: string;
    end_date?: string;
    note?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Nieprawidłowy wniosek." };
  }
  const dates = input.dates
    ? normalizeDates(input.dates)
    : input.start_date && input.end_date && DATE_RE.test(input.start_date) && DATE_RE.test(input.end_date)
      ? eachDay(input.start_date, input.end_date)
      : null;
  if (!dates) {
    return { ok: false, error: "Wybierz przynajmniej jeden dzień urlopu." };
  }
  const note = input.note?.trim() || null;

  try {
    return await withTransaction(async (tx) => {
      const current = await tx.query<{
        id: number;
        employee_id: number;
        status: string;
      }>(
        `SELECT id, employee_id, status FROM leave_requests WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (current.rows.length === 0) {
        return { ok: false as const, error: "Wniosek nie istnieje." };
      }
      const leave = current.rows[0];

      // Autor: worker tylko własny wniosek; szef dowolny.
      if (session.role === "worker") {
        if (leave.employee_id !== session.employeeId) {
          return {
            ok: false as const,
            error: "Możesz edytować tylko własne wnioski.",
          };
        }
      }

      // Stan w chwili zapisu (transakcja z blokadą wiersza): jeśli szef
      // zatwierdził w trakcie edycji, ta aktualizacja NIE wejdzie.
      if (leave.status !== "pending") {
        return {
          ok: false as const,
          error:
            "Wniosek został już rozpatrzony — nie można go zmienić.",
        };
      }

      const conflict = await findDateConflict(tx, leave.employee_id, dates, id);
      if (conflict !== null) {
        return {
          ok: false as const,
          error:
            "Ten pracownik ma już aktywny wniosek obejmujący wybrane dni.",
        };
      }

      await tx.query(
        `UPDATE leave_requests SET note = $1 WHERE id = $2 AND status = 'pending'`,
        [note, id]
      );
      await writeLeaveDates(tx, id, dates);
      return { ok: true as const };
    });
  } catch (err) {
    console.error("updateLeaveRequestForSession:", err);
    return { ok: false, error: "Nie udało się zapisać zmian wniosku." };
  }
}

/**
 * Decyzja kierownika: TYLKO rola boss (sprawdzana serwerowo), tylko ze stanu
 * oczekującego. Rozpatrujący = zalogowany szef z sesji (nie konto techniczne).
 */
export async function reviewLeaveRequestForSession(
  session: SessionUser,
  input: { id: number; decision: "approve" | "reject" }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.role !== "boss") {
    return { ok: false, error: "Tylko szef może rozpatrywać wnioski." };
  }
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Nieprawidłowy wniosek." };
  }
  if (input.decision !== "approve" && input.decision !== "reject") {
    return { ok: false, error: "Nieprawidłowa decyzja." };
  }

  const status = input.decision === "approve" ? "approved" : "rejected";
  const res = await query<{ id: number }>(
    `UPDATE leave_requests
     SET status = $1, reviewed_by_user_id = $2, reviewed_at = now()
     WHERE id = $3 AND status = 'pending'
     RETURNING id`,
    [status, session.userId, id]
  );
  if (res.rows.length === 0) {
    return {
      ok: false,
      error: "Wniosek jest już rozpatrzony — decyzja została podjęta wcześniej.",
    };
  }
  return { ok: true };
}
