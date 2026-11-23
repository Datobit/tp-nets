-- 007_reports_edit_delete.sql — edycja i miękkie usuwanie raportów.
-- Usunięcie = deleted_at (nie kasuje wiersza ani pozycji); przywraca je szef.
-- Edycja nadpisuje wartości — historia poprzedniej treści nie jest wymagana
-- (raport roboczy, nie dokument księgowy); zmiany śledzi updated_at.

BEGIN;

ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS updated_at timestamptz
    NOT NULL DEFAULT now();
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS deleted_by_user_id
    integer REFERENCES users(id);

COMMIT;
