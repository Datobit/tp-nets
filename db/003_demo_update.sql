-- 003_demo_update.sql — jednorazowa, bezpieczna aktualizacja danych demo.
-- Idempotentny: ponowne uruchomienie nie duplikuje danych i nie zmienia
-- już podjętych decyzji. NIE modyfikuje schematu, historii raportów
-- ani wniosków (poza zatwierdzeniem jednego wniosku Adama Kowalskiego,
-- jeśli dokładnie jeden jest oczekujący).

BEGIN;

-- 1. Pięć nowych pracowników demo (schemat wymaga niepustego nazwiska —
--    użyto jawnego znacznika 'Demo'; selektory pokazują samo imię).
INSERT INTO employees (first_name, last_name, is_active, can_be_assigned)
SELECT v.first_name, 'Demo', true, true
FROM (VALUES
    ('Tobiasz'),
    ('Dominik'),
    ('Rafał'),
    ('Szymon'),
    ('Paweł')
) AS v(first_name)
WHERE NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.first_name = v.first_name AND e.last_name = 'Demo'
);

-- 2. Wycofanie dotychczasowych fikcyjnych monterów z wyboru w nowych
--    formularzach (mechanizm is_active). Historia raportów, wniosków
--    i przypisań pozostaje bez zmian; konto techniczne nietknięte.
UPDATE employees
SET is_active = false
WHERE (first_name, last_name) IN (('Adam', 'Kowalski'), ('Barbara', 'Nowak'))
  AND is_active;

-- 3. Zatwierdzenie wniosku Adama Kowalskiego — WYŁĄCZNIE gdy ma dokładnie
--    jeden oczekujący wniosek. Rozpatrujące: konto techniczne demo,
--    czas decyzji: now(). Zakres dat i uwagi bez zmian. Przy 0 lub
--    wielu oczekujących wnioska ten UPDATE nie zmienia nic (0 wierszy).
UPDATE leave_requests
SET status = 'approved',
    reviewed_by_user_id = (
        SELECT u.id FROM users u
        WHERE lower(u.email) = lower('demo@tp-nets.local') AND u.is_active
        LIMIT 1
    ),
    reviewed_at = now()
WHERE status = 'pending'
  AND employee_id = (
      SELECT id FROM employees
      WHERE first_name = 'Adam' AND last_name = 'Kowalski'
      LIMIT 1
  )
  AND (
      SELECT count(*)
      FROM leave_requests
      WHERE status = 'pending'
        AND employee_id = (
            SELECT id FROM employees
            WHERE first_name = 'Adam' AND last_name = 'Kowalski'
            LIMIT 1
        )
  ) = 1;

COMMIT;

-- Weryfikacja (do odczytu po skrypcie): wnioski Adama, aktywni pracownicy,
-- zatwierdzone urlopy w kalendarzu.
SELECT 'WNIOSKI ADAMA' AS sekcja, lr.id, lr.start_date, lr.end_date,
       lr.status, lr.reviewed_at
FROM leave_requests lr
JOIN employees e ON e.id = lr.employee_id
WHERE e.first_name = 'Adam' AND e.last_name = 'Kowalski'
ORDER BY lr.id;

SELECT 'PRACOWNICY AKTYWNI' AS sekcja, e.id, e.first_name, e.last_name,
       e.can_be_assigned
FROM employees e
WHERE e.is_active
ORDER BY e.last_name, e.first_name;

SELECT 'KALENDARZ (ZATWIERDZONE)' AS sekcja, lr.id,
       (e.last_name || ' ' || e.first_name) AS osoba,
       lr.start_date, lr.end_date
FROM leave_requests lr
JOIN employees e ON e.id = lr.employee_id
WHERE lr.status = 'approved'
ORDER BY lr.start_date;
