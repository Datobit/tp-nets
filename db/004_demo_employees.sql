-- 004_demo_employees.sql — jednorazowa, idempotentna aktualizacja WYŁĄCZNIE
-- tabeli employees (bez wniosków urlopowych, decyzji, raportów, kont).
-- Ponowne uruchomienie nie duplikuje danych ani nie zmienia stanu.

BEGIN;

-- 1. Piątka pracowników demo: aktywni, dostępni jako monterzy.
--    Techniczne nazwisko 'Demo' (kolumna NOT NULL); selektory pokazują
--    samo imię (logika displayName w aplikacji).
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

-- 2. Wycofanie fikcyjnych monterów z selektorów nowych formularzy
--    (mechanizm is_active; konto techniczne i rekordy pozostają).
--    Historia raportów, przypisań i wniosków urlopowych bez zmian —
--    zatwierdzony urlop Adama nadal trafia do kalendarza (zapytanie
--    kalendarza nie filtruje po is_active).
UPDATE employees
SET is_active = false
WHERE (first_name, last_name) IN (('Adam', 'Kowalski'), ('Barbara', 'Nowak'))
  AND is_active;

COMMIT;

-- Weryfikacja: pełny stan tabeli employees.
SELECT id, first_name, last_name, is_active, can_be_assigned
FROM employees
ORDER BY id;
