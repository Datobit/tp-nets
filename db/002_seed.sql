-- Seed demo TP-NETS — fikcyjne dane, bezpieczny do wielokrotnego uruchomienia.
-- Wymaga tabel z db/001_schema.sql (inicjalizacja świeżego wolumenu).
-- Wszystkie tabele mają id GENERATED ALWAYS AS IDENTITY, więc INSERT-y
-- nie podają id — identyfikatory zależnych rekordów są pobierane po
-- stabilnych kluczach naturalnych (email, nazwa obiektu, tytuł zlecenia,
-- imię+nazwisko). Powtórne uruchomienie nie dubluje ani nie nadpisuje danych.

BEGIN;

-- 1. Konto techniczne (wymagane przez work_reports.created_by_user_id).
--    Hasło jest nieistotne na etapie bez logowania — hash to fikcyjny
--    placeholder bcrypt, nie hasło żadnego konta.
INSERT INTO employees (first_name, last_name, can_be_assigned)
SELECT 'Konto', 'Techniczne', false
WHERE NOT EXISTS (
    SELECT 1 FROM employees
    WHERE first_name = 'Konto' AND last_name = 'Techniczne'
);

INSERT INTO users (employee_id, email, password_hash, role, is_active)
SELECT e.id, 'demo@tp-nets.local',
       '$2b$10$C6UzMDM.H6dfI/f/IKcEe.uT3j0XsPZ8xL2Qg2dW/1rZ8kYc9u5uW',
       'technical', true
FROM employees e
WHERE e.first_name = 'Konto' AND e.last_name = 'Techniczne'
ON CONFLICT (lower(email)) DO NOTHING;

-- 2. Obiekt i zlecenie
INSERT INTO locations (name, address)
SELECT 'Zakład BSH — demo', 'ul. Demostradowska 1, 61-001 Poznań'
WHERE NOT EXISTS (
    SELECT 1 FROM locations WHERE name = 'Zakład BSH — demo'
);

INSERT INTO orders (location_id, title, department, place, status, planned_end_date)
SELECT l.id, 'Ładowarki do samochodów elektrycznych', 'Elektryka',
       'Parking poziom P1, okolice bramy 3', 'in_progress', CURRENT_DATE + 30
FROM locations l
WHERE l.name = 'Zakład BSH — demo'
  AND NOT EXISTS (
      SELECT 1 FROM orders o
      WHERE o.title = 'Ładowarki do samochodów elektrycznych'
        AND o.location_id = l.id
  );

-- 3. Dwóch monterów
INSERT INTO employees (first_name, last_name, can_be_assigned)
SELECT v.first_name, v.last_name, true
FROM (VALUES
    ('Adam', 'Kowalski'),
    ('Barbara', 'Nowak')
) AS v(first_name, last_name)
WHERE NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.first_name = v.first_name AND e.last_name = v.last_name
);

-- Przypisanie do zlecenia
INSERT INTO order_assignments (order_id, employee_id)
SELECT o.id, e.id
FROM orders o
JOIN employees e
  ON (e.first_name, e.last_name) IN (('Adam', 'Kowalski'), ('Barbara', 'Nowak'))
WHERE o.title = 'Ładowarki do samochodów elektrycznych'
ON CONFLICT (order_id, employee_id) DO NOTHING;

-- 4. Materiały katalogowe (jednostka katalogowa)
INSERT INTO materials (name, base_unit)
VALUES
    ('Kabel typu YDY 3×2,5 mm² — demo', 'm'),
    ('Ładowarka wallbox 11 kW — demo', 'szt.'),
    ('Rura osłonowa 32 mm — demo', 'm')
ON CONFLICT (name) DO NOTHING;

COMMIT;
