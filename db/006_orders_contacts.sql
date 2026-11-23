-- 006_orders_contacts.sql — zlecenia: numer, osoba zlecająca z kontaktów obiektu.
-- Kolejność numerów: kolejność zleceń (id) obiektu — nie zmienia istniejących
-- identyfikatorów ani danych; istniejące zlecenia dostają numer w formacie
-- ZR/<rok zgłoszenia>/<kolejność w roku>. Wymagane pola są wymuszane dla
-- NOWYCH zlecenń przez aplikację; kolumna requested_by_contact_id jest
-- nullable, żeby migracja nie wymusiła wymyślania kontaktów dla istniejącej
-- historii (stare zlecenia zostają bez zlecającego — brak zgadywania).

BEGIN;

-- 1. Kontakty przypisane do obiektu (osoby zlecające). Dane: pełna nazwa
--    wyświetlana + opcjonalny telefon/e-mail. Bez usuwania i bez zmian
--    istniejących tabel.
CREATE TABLE IF NOT EXISTS location_contacts (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_id integer NOT NULL REFERENCES locations(id),
    full_name text NOT NULL CHECK (btrim(full_name) <> ''),
    phone text,
    email text,
    is_active boolean NOT NULL DEFAULT true,
    UNIQUE (location_id, full_name)
);
CREATE INDEX IF NOT EXISTS location_contacts_location_idx
    ON location_contacts (location_id) WHERE is_active;

-- 2. Numer zlecenia — unikalny, generowany z sekwencji na rok. Format
--    ZR/<rok>/<nr>. Kolumna NOT NULL: wypełniana migracją dla istniejących
--    wierszy i automatycznie dla nowych.
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique
    ON orders (order_number) WHERE order_number IS NOT NULL;

-- Wypełnienie dla istniejących zleceń: rok z created-at nie istnieje w
-- schemacie — użyto roku bieżącego przy migracji; kolejność = kolejność id
-- (podzapytanie z numerowaniem, bo window function nie działa w UPDATE).
UPDATE orders o
SET order_number = n.number
FROM (
    SELECT id,
           'ZR/' || to_char(now(), 'YYYY') || '/' ||
               lpad((row_number() OVER (ORDER BY id))::text, 4, '0') AS number
    FROM orders
) n
WHERE o.id = n.id AND o.order_number IS NULL;

ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;

-- Sekwencja za istniejącymi numerami (kolejne zlecenie: ostatni numer + 1).
SELECT setval('order_number_seq',
    GREATEST((SELECT count(*) FROM orders), 1));

-- 3. Osoba zlecająca (kontakt obiektu). Nullable — stare zlecenia bez niej
--    są ważne; nowe zlecenia wymagają jej w aplikacji.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requested_by_contact_id
    integer REFERENCES location_contacts(id);

CREATE INDEX IF NOT EXISTS orders_requested_by_idx
    ON orders (requested_by_contact_id);

COMMIT;
