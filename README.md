# TP-NETS — podgląd demo

Aplikacja do protokołów prac serwisowych (Next.js + TypeScript + Tailwind +
shadcn/ui, PostgreSQL, Docker Compose). Stan obecny: działający przepływ
raportu dziennego — lista raportów, formularz (zlecenie, data, 1–3 monterów,
opis, materiały), zapis w transakcji i szczegóły raportu. Logowanie, koszty
i urlopy dojdą w kolejnych etapach.

## Seed demo

Baza startuje z pustymi tabelami (schemat z `db/001_schema.sql`). Wgraj dane
demo (jedno zlecenie, dwóch monterów, konto techniczne, katalog materiałów) —
skrypt jest idempotentny, można go uruchamiać wielokrotnie:

    docker compose exec -T db psql -U tp_nets -d tp_nets -v ON_ERROR_STOP=1 < db/002_seed.sql

Sprawdzenie zawartości:

    docker compose exec db psql -U tp_nets -d tp_nets -c "SELECT id, title FROM orders; SELECT id, first_name, last_name FROM employees;"

## Wdrożenie nowej wersji aplikacji (bez kasowania wolumenu)

    docker compose up -d --build app

Jeśli zmienisz tylko kod, a zależności w `package.json` pozostaaną bez zmian,
build użyje cache warstwy deps.

## Uruchomienie od zera (świeży wolumen — usuwa dane!)

    docker compose down -v   # UWAGA: kasuje wolumen i dane
    docker compose up -d --build

## Test na telefonie (przez Tailscale Serve)

1. Upewnij się, że aplikacja działa: `curl -I http://127.0.0.1:3000`
   (jeśli używasz innego portu hosta, zamień).
2. Serve (jednorazowo, z hosta): `tailscale serve --bg http://127.0.0.1:3000`
   i sprawdź `tailscale serve status`.
3. Na telefonie (w tym samym tailnet) otwórz adres HTTPS z
   `tailscale serve status`.
4. Test ręczny: „Nowy raport” → wybierz zlecenie → data (domyślnie dziś) →
   monterzy (1–3) → opis → dodaj materiał „Kabel typu YDY 3×2,5 mm² — demo”,
   ilość 75 → „Zapisz raport” → szczegóły raportu. Odśwież stronę — raport
   ma pozostać na liście i w szczegółach.


## Struktura

- `Dockerfile` — obraz aplikacji (Node 22, Next.js standalone build przez `npm run start`).
- `compose.yaml` — dwa serwisy: `app` (publikowany **tylko** na `127.0.0.1:3000:3000`)
  i `db` (PostgreSQL 18, port **niepublikowany** na hoście).
- `db/001_schema.sql` — schemat bazy, montowany read-only do
  `/docker-entrypoint-initdb.d/001_schema.sql` (wykonywany tylko przy
  inicjalizacji **świeżego** wolumenu; istniejącego wolumenu nie kasuj,
  żeby nie stracić danych).
- `.env.example` — wzór zmiennych (`POSTGRES_PASSWORD` wymagane,
  `APP_PUBLIC_URL` opcjonalne, pod późniejsze Tailscale Serve).
- Wolumen nazwany: `tp_nets_pgdata`.

## Start (ręcznie, na hoście)

    cp .env.example .env      # ustaw POSTGRES_PASSWORD
    docker compose up -d --build

Sprawdzenie:

    docker compose ps
    curl -I http://127.0.0.1:3000

## Sprawdzenie schematu w PostgreSQL

    docker compose exec db psql -U tp_nets -d tp_nets -c "\dt"

Powinno zwrócić 12 tabel: employees, users, locations, orders,
order_assignments, materials, material_purchases,
order_planned_materials, work_reports, report_employees,
report_materials, leave_requests.

Sprawdzenie, że inicjalizacja wykonała schemat (tabela musi istnieć):

    docker compose exec db psql -U tp_nets -d tp_nets -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"

## Tailscale Serve (uruchom samodzielnie)

Aplikacja ma być widoczna z telefonu przez Tailscale Serve — bez Funnel,
bez publicznego dostępu:

    tailscale serve --bg http://127.0.0.1:3000
    tailscale serve status

Po włączeniu Serve ustaw w `.env`:

    APP_PUBLIC_URL=https://<twoj-host>.<twoj-tailnet>.ts.net

i zrestartuj aplikację (`docker compose up -d --force-recreate app`),
żeby logowanie/przekierowania używały adresu HTTPS zamiast localhost.

## Uwagi

- Port aplikacji na hoście: `127.0.0.1:3000` (jeśli zajęty, zmień w
  `compose.yaml` na np. `127.0.0.1:3001:3000` i użyj tego portu w `curl`
  oraz w `tailscale serve`).
- Nie uruchamiaj seedowania przez kasowanie wolumenu; seed dojdzie w
  kolejnym etapie jako powtarzalny skrypt.
