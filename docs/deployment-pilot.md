# Procedura wdrożenia pilotażu tp-nets-pilot (wtorek 24 listopada)

## Co wchodzi

- Migracje `db/006`–`db/009` (idempotentne, w transakcjach, bez kasowania danych).
- Nowe funkcje: zlecenia z numerem i kontaktem z obiektu, widok szefa
  `/reports/all`, edycja/usuwanie/restore raportów, zakładka Materiały
  (katalog/zakupy/zużycie), urlopy z zaznaczaniem dni w kalendarzu.
- `db/010_pilot_test_data.sql` — WYŁĄCZNIE na kopii testowej. **Nie
  uruchamiać na bazie roboczej** (wpisuje fikcyjne kontakty i obiekt testowy).

## Warunki wstępne

- Kopia zapasowa bazy roboczej (krok 1 poniżej) + potwierdzone odtworzenie
  na osobnej bazie.
- Dostęp do dockera na laptopie (`docker compose ps` działa bez sudo).
- Konta Łukasz i Tobiasz istnieją na roboczej bazie — nie tworzymy nowych.

## 1. Kopia zapasowa i test odtworzenia (PRZED wdrożeniem)

    cd ~/tp-nets
    docker compose exec -T db pg_dump -U tp_nets -d tp_nets > backup-tp-nets-$(date +%Y%m%d-%H%M).sql

Odtworzenie NA OSOBNEJ bazie testowej (nie na roboczej):

    docker run --rm -v "$PWD/backup-tp-nets-....sql:/backup.sql:ro" postgres:18-alpine \
      pg_restore --help >/dev/null  # kontrola obrazu
    # wariant z psql (dump to plain SQL):
    docker compose exec -T db createdb -U tp_nets tp_nets_restore_test
    docker compose exec -T db psql -U tp_nets -d tp_nets_restore_test -v ON_ERROR_STOP=1 -f /dev/stdin < backup-tp-nets-....sql
    docker compose exec -T db psql -U tp_nets -d tp_nets_restore_test -c "SELECT count(*) FROM work_reports;"
    # porównanie liczebności kluczowych tabel z roboczą, potem:
    docker compose exec -T db dropdb -U tp_nets tp_nets_restore_test

Jeśli odtworzenie nie przejdzie — STOP, nie wdrażać.

## 2. Test migracji na kopii (PRZED wdrożeniem)

Na bazie `tp_nets_restore_test` (odtworzona kopia roboczej):

    cat db/006_orders_contacts.sql db/007_reports_edit_delete.sql \
        db/008_leaves_multidate.sql db/009_materials_catalog.sql \
      | docker compose exec -T db psql -U tp_nets -d tp_nets_restore_test -v ON_ERROR_STOP=1

Kontrola po migracji:

    docker compose exec -T db psql -U tp_nets -d tp_nets_restore_test \
      -c "SELECT id, order_number, title FROM orders ORDER BY id LIMIT 5;" \
      -c "SELECT count(*) FROM leave_request_dates;" \
      -c "SELECT count(*) FROM location_contacts;"

## 3. Wdrożenie na roboczej

    cd ~/tp-nets
    git fetch origin && git checkout tp-nets-pilot
    npm run build          # kontrola kompilacji lokalnie
    docker compose up -d --build app

Migracje na roboczej (po kolei, sprawdzając wynik każdej):

    docker compose exec -T db psql -U tp_nets -d tp_nets -v ON_ERROR_STOP=1 -f /dev/stdin < db/006_orders_contacts.sql
    docker compose exec -T db psql -U tp_nets -d tp_nets -v ON_ERROR_STOP=1 -f /dev/stdin < db/007_reports_edit_delete.sql
    docker compose exec -T db psql -U tp_nets -d tp_nets -v ON_ERROR_STOP=1 -f /dev/stdin < db/008_leaves_multidate.sql
    docker compose exec -T db psql -U tp_nets -d tp_nets -v ON_ERROR_STOP=1 -f /dev/stdin < db/009_materials_catalog.sql

## 4. Weryfikacja po wdrożeniu (zapis w bazie, nie wygląd)

Zaloguj się jako Łukasz i Tobiasz (konta istniejące). Sprawdź:

    # dwa aktywne zlecenia Gabińskiego (kontakt obiektu)
    docker compose exec -T db psql -U tp_nets -d tp_nets \
      -c "SELECT o.order_number, o.title FROM orders o JOIN location_contacts c ON c.id=o.requested_by_contact_id WHERE c.full_name='Jacek Gabiński' AND o.status<>'done';"
    # raport po edycji ma zmienione dane + updated_at
    docker compose exec -T db psql -U tp_nets -d tp_nets \
      -c "SELECT id, place_details, updated_at FROM work_reports ORDER BY id DESC LIMIT 3;"

W aplikacji (telefon przez Tailscale): otwórz raport, edytuj własny,
usuń z potwierdzeniem, u Łukasza przywróć; wniosek 2+4 grudnia bez 3-go;
PIR jako zużycie bez ceny; opaska 0,5 paczki.

## 5. Wycofanie (rollback)

Kod:

    git checkout main && docker compose up -d --build app

Baza (dane wracają 1:1 z dumpa; migracje 006–009 NIE są destrukcyjne,
ale rollback danych daje pewność):

    # zatrzymaj aplikację, żeby nic nie zapisywało w trakcie odtwarzania
    docker compose stop app
    docker compose exec -T db psql -U tp_nets -d postgres -c "DROP DATABASE tp_nets;"
    docker compose exec -T db createdb -U tp_nets tp_nets
    docker compose exec -T db psql -U tp_nets -d tp_nets -v ON_ERROR_STOP=1 -f /dev/stdin < backup-tp-nets-....sql
    docker compose start app

Uwaga: DROP DATABASE tylko w ramach rollbacku z pełnym dumpem w ręku —
dlatego krok 1 jest warunkiem wdrożenia.

## Czego NIE robić

- Nie uruchamiać `db/003_demo_update.sql` ani `db/004_demo_employees.sql`
  na roboczej bazie (dane demo).
- Nie kasować wolumenu `tp_nets_pgdata`.
- Nie resetować kont Łukasz/Tobiasz.
