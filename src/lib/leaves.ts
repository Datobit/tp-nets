import { query } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export interface EmployeeBasic {
  id: number;
  first_name: string;
  last_name: string;
}

/** Osoby demo mają techniczne nazwisko „Demo” — pokazujemy samo imię. */
export function displayName(e: { first_name: string; last_name: string }) {
  return e.last_name === "Demo" ? e.first_name : `${e.last_name} ${e.first_name}`;
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
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
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
            CASE WHEN $1 = 'boss' OR lr.employee_id = $2 THEN lr.note END AS note,
            lr.status,
            to_char(lr.reviewed_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS reviewed_at
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     WHERE ($1 = 'boss' OR lr.employee_id = $2)
     ORDER BY lr.start_date DESC, lr.id DESC`,
    [session.role, session.employeeId ?? -1]
  );
  return res.rows;
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

/**
 * Nowy wniosek. Pracownik (worker) ZAWSZE za siebie — employee_id z sesji,
 * wysłany przez klienta identyfikator jest ignorowany. Szef może złożyć
 * za wskazanego pracownika. Autor = pracownik powiązany z kontem z sesji.
 */
export async function createLeaveRequestForSession(
  session: SessionUser,
  input: {
    employee_id: number;
    start_date: string;
    end_date: string;
    note?: string | null;
  }
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!DATE_RE.test(input.start_date) || !DATE_RE.test(input.end_date)) {
    return { ok: false, error: "Podaj poprawne daty wniosku." };
  }
  if (input.end_date < input.start_date) {
    return {
      ok: false,
      error: "Data „do” nie może być wcześniejsza niż data „od”.",
    };
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

  const employee = await query(
    `SELECT id FROM employees WHERE id = $1 AND is_active`,
    [employeeId]
  );
  if (employee.rows.length === 0) {
    return { ok: false, error: "Wybrany pracownik nie istnieje." };
  }

  // Blokada drugiego AKTYWNEGO wniosku (pending/approved) na nakładające się
  // dni — daty włącznie. Odrzucony wniosek nie blokuje ponownego złożenia.
  const overlap = await query<{ id: number }>(
    `SELECT id FROM leave_requests
     WHERE employee_id = $1
       AND status IN ('pending', 'approved')
       AND start_date <= $3::date
       AND end_date >= $2::date
     LIMIT 1`,
    [employeeId, input.start_date, input.end_date]
  );
  if (overlap.rows.length > 0) {
    return {
      ok: false,
      error:
        "Ten pracownik ma już aktywny wniosek na nakładające się dni (daty są włączne).",
    };
  }

  const res = await query<{ id: number }>(
    `INSERT INTO leave_requests (employee_id, start_date, end_date, note)
     VALUES ($1, $2::date, $3::date, $4)
     RETURNING id`,
    [employeeId, input.start_date, input.end_date, note]
  );
  return { ok: true, id: res.rows[0].id };
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
