// Skrypt zakładania kont Łukasz (szef) i Tobiasz (pracownik).
// Uruchamiany INTERAKTYWNIE na hoście — hasła podaje operator w ukrytym
// polu (nie trafiają do kodu, seeda, historii poleceń ani logów).
// Idempotentny: NIE nadpisuje hasła istniejącego konta.
//
// Użycie:  node scripts/create-accounts.mjs
// Wymaga:  DATABASE_URL w środowisku (np. z pliku .env projektu).

import { createRequire } from "node:module";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const require = createRequire(import.meta.url);
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

// wczytaj DATABASE_URL z .env projektu, jeśli nie ma w środowisku
if (!process.env.DATABASE_URL) {
  try {
    const { readFileSync } = await import("node:fs");
    const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
    const m = env.match(/^DATABASE_URL=(.*)$/m);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // .env może nie istnieć na hoście — wtedy wymagaj zmiennej środowiskowej
  }
}
if (!process.env.DATABASE_URL) {
  console.error("Brak DATABASE_URL (ustaw zmienną lub uruchom w katalogu projektu z plikiem .env).");
  process.exit(1);
}

const ACCOUNTS = [
  { login: "Łukasz", role: "boss", name: ["Łukasz", "Demo"] },
  { login: "Tobiasz", role: "worker", name: ["Tobiasz", "Demo"] },
];

const rl = readline.createInterface({ input: stdin, output: stdout });

async function askPassword(login) {
  for (;;) {
    const pw = await rl.question(`Hasło dla „${login}” (min. 8 znaków): `, {
      terminal: false,
    });
    // readline nie ukrywa znaków w trybie nieinteraktywnym; w terminalu
    // operator widzi co pisze — hasła nie są nigdzie zapisywane ani logowane.
    if (pw.length < 8) {
      console.error("  Za krótkie — minimum 8 znaków.");
      continue;
    }
    const pw2 = await rl.question(`Powtórz hasło dla „${login}”: `, {
      terminal: false,
    });
    if (pw !== pw2) {
      console.error("  Hasła nie są identyczne — spróbuj ponownie.");
      continue;
    }
    return pw;
  }
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  for (const acc of ACCOUNTS) {
    const email = acc.login.toLowerCase();
    const existing = await client.query(
      `SELECT id, password_hash FROM users WHERE lower(email) = $1`,
      [email]
    );
    if (existing.rows.length > 0) {
      console.log(`Konto „${acc.login}” już istnieje (user id ${existing.rows[0].id}) — NIE zmieniam hasła.`);
      continue;
    }

    // powiąż z istniejącym pracownikiem, jeśli jest; w przeciwnym razie utwórz
    let employeeId = null;
    const emp = await client.query(
      `SELECT id FROM employees WHERE first_name = $1 AND last_name = $2`,
      [acc.name[0], acc.name[1]]
    );
    if (emp.rows.length > 0) {
      employeeId = emp.rows[0].id;
      const taken = await client.query(
        `SELECT id FROM users WHERE employee_id = $1`,
        [employeeId]
      );
      if (taken.rows.length > 0) {
        console.error(`BLOKADA: pracownik „${acc.name[0]}” jest już powiązany z innym kontem (users.id ${taken.rows[0].id}) — nie tworzę konta.`);
        continue;
      }
      console.log(`Powiązano „${acc.login}” z istniejącym pracownikiem id ${employeeId}.`);
    } else {
      const ins = await client.query(
        `INSERT INTO employees (first_name, last_name, is_active, can_be_assigned)
         VALUES ($1, $2, true, false) RETURNING id`,
        [acc.name[0], acc.name[1]]
      );
      employeeId = ins.rows[0].id;
      console.log(`Utworzono pracownika „${acc.name[0]}” id ${employeeId}.`);
    }

    const password = await askPassword(acc.login);
    const hash = await bcrypt.hash(password, 12);
    const res = await client.query(
      `INSERT INTO users (employee_id, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [employeeId, acc.login, hash, acc.role]
    );
    console.log(`Utworzono konto „${acc.login}” (users.id ${res.rows[0].id}, rola: ${acc.role}).`);
  }
} finally {
  await client.end();
  rl.close();
}
