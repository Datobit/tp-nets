-- 009_materials_catalog.sql — zakupy materiałów (magazyn).
-- Katalog i zużycie (report_materials) już istnieją; zakupy opisują, kto,
-- co, ile, w jakiej jednostce i za ile kupił. Jednostka zakupu może różnić
-- się od jednostki katalogowej (podpowiedź, nie wymuszenie): nie ma
-- przelicznika, więc aplikacja NIE sumuje pozycji w różnych jednostkach.
-- Zużycie bez ceny: suggested_cost_net już jest nullable w schemacie
-- (CHECK zezwala na NULL) — brak ceny = NULL, nie 0 zł; zużycie z magazynu
-- bez wcześniejszego zakupu (purchase_id NULL) już jest możliwe.

BEGIN;

-- Jednostka zakupu (może być inna niż katalogowa, np. paczka vs szt.).
ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS unit text;

-- Wstępne wypełnienie dla istniejących zakupów: jednostka katalogowa.
UPDATE material_purchases mp
SET unit = m.base_unit
FROM materials m
WHERE mp.material_id = m.id AND mp.unit IS NULL;

ALTER TABLE material_purchases ALTER COLUMN unit SET NOT NULL;

-- Kupujący (imię i nazwisko osoby — wolny tekst, nie konto). Wiersz 1:1.
CREATE TABLE IF NOT EXISTS material_purchases_ext_info (
    purchase_id integer PRIMARY KEY REFERENCES material_purchases(id) ON DELETE CASCADE,
    buyer_name text NOT NULL CHECK (btrim(buyer_name) <> ''),
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
