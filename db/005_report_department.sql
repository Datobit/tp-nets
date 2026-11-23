-- 005_report_department.sql — migracja: dział ustalany per raport.
-- Kolumna work_reports.department (nullable — stare raporty bez działu
-- pozostają ważne). Typ text, spójnie z orders.department.
-- Idempotentna (IF NOT EXISTS). Nie zmienia db/001_schema.sql ani danych.

BEGIN;

ALTER TABLE work_reports
    ADD COLUMN IF NOT EXISTS department text;

COMMIT;
