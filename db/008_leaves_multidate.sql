-- 008_leaves_multidate.sql — wnioski urlopowe z dokładnymi, nieciągłymi datami.
-- Zamiast zakresu start–end: tabela dni wniosku (dzień = jeden wiersz).
-- Istniejące wnioski (zakresowe) dostają po dniu z zakresu — treść bez zmian.
-- start_date/end_date zostają (migracja bezpieczna, stary kod czyta zakres);
-- nowe wnioski zapisują start=min, end=max spójnie z listą dni.

BEGIN;

CREATE TABLE IF NOT EXISTS leave_request_dates (
    leave_request_id integer NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    leave_date date NOT NULL,
    PRIMARY KEY (leave_request_id, leave_date)
);

-- Wypełnienie dla istniejących wniosków: każdy dzień z zakresu.
INSERT INTO leave_request_dates (leave_request_id, leave_date)
SELECT lr.id, d::date
FROM leave_requests lr
CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, interval '1 day') AS d
ON CONFLICT DO NOTHING;

COMMIT;
