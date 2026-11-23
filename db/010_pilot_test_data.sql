-- 010_pilot_test_data.sql — DANE TESTOWE DO PILOTAŻU (fikcyjne).
-- UWAGA: NIE URUCHAMIAĆ na roboczej bazie laptopa! Wyłącznie na kopii
-- testowej (tp_nets_pilot). Kontakty Jacek Gabiński / Adrian Lesiak są
-- tu FIKCYJNE (dane testowe) — w roboczej bazie pojawią się dopiero po
-- decyzji użytkownika.
--
-- Uzupełnia konta testowe: Łukasz (szef), Tobiasz i Marek (pracownicy),
-- obiekt „Zakład Testowy”, kontakty, materiały (w tym Czujka PIR bez
-- zakupu, Opaska ostrzegawcza), zlecenia testowe.
--
-- Hasła kont testowych ustawia tests/seed-test-db.mjs (bcrypt, interakcja
-- zbędna — hasła testowe, nie produkcyjne).

BEGIN;

-- Konta pracowników (bez haseł — hasła w seedzie node'owym).
INSERT INTO employees (first_name, last_name, is_active, can_be_assigned)
SELECT v.first_name, v.last_name, true, true
FROM (VALUES
    ('Łukasz', 'Testowy'),
    ('Tobiasz', 'Testowy'),
    ('Marek', 'Testowy')
) AS v(first_name, last_name)
WHERE NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.first_name = v.first_name AND e.last_name = v.last_name
);

-- Obiekt testowy
INSERT INTO locations (name, address)
SELECT 'Zakład Testowy', 'ul. Testowa 1, 61-001 Poznań'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Zakład Testowy');

-- Kontakty obiektu testowego (fikcyjne osoby do testów)
INSERT INTO location_contacts (location_id, full_name, phone, is_active)
SELECT l.id, v.full_name, v.phone, true
FROM locations l
CROSS JOIN (VALUES
    ('Jacek Gabiński', '+48 600 100 200'),
    ('Adrian Lesiak', '+48 600 300 400')
) AS v(full_name, phone)
WHERE l.name = 'Zakład Testowy'
  AND NOT EXISTS (
      SELECT 1 FROM location_contacts c
      WHERE c.location_id = l.id AND c.full_name = v.full_name
  );

-- Materiały testowe
INSERT INTO materials (name, base_unit, is_active)
SELECT v.name, v.unit, true
FROM (VALUES
    ('Czujka PIR', 'szt.'),
    ('Opaska ostrzegawcza', 'szt.'),
    ('Kabel YDY 3×1,5', 'm')
) AS v(name, unit)
WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.name = v.name);

COMMIT;
