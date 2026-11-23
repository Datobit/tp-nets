"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EmployeeBasic {
  id: number;
  first_name: string;
  last_name: string;
}

export interface EditableLeave {
  id: number;
  employee_id: number;
  employee_name: string;
  status: string;
  dates: string[];
  note: string | null;
}

/**
 * Wyświetlana nazwa pracownika. Osoby z technicznym nazwiskiem „Demo”
 * (dane tymczasowe) pokazywane są samo imieniem; nazwiska poprawi migracja.
 */
function displayName(e: { first_name: string; last_name: string }) {
  return e.last_name === "Demo" ? e.first_name : e.first_name;
}

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MAX_MONTHS_FORWARD = 6;

function todayWarsaw(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Nowy / edytowany wniosek: zaznaczanie DNI w kalendarzu (bez pól od–do).
 * Klik = dodaj dzień, drugi klik = odznacz. Dni nie muszą być ciągłe:
 * 2 i 4 grudnia bez 3-go to jeden wniosek z dwiema datami.
 */
export default function LeaveDayPickerForm({
  employees,
  boss = false,
  editing,
}: {
  employees: EmployeeBasic[];
  boss?: boolean;
  /** Edytowany wniosek (tylko oczekujący, własny) albo null = nowy wniosek. */
  editing?: EditableLeave | null;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<string>(
    editing
      ? String(editing.employee_id)
      : employees[0]
        ? String(employees[0].id)
        : ""
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(editing?.dates ?? [])
  );
  const [note, setNote] = useState<string>(editing?.note ?? "");
  const [monthKey, setMonthKey] = useState<string>(todayWarsaw().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const [year, month] = useMemo(
    () => monthKey.split("-").map(Number) as [number, number],
    [monthKey]
  );
  const cells = useMemo(() => buildCells(year, month - 1), [year, month]);
  const currentKey = todayWarsaw().slice(0, 7);
  const atForwardLimit =
    (() => {
      const [cy, cm] = currentKey.split("-").map(Number);
      const [dy, dm] = monthKey.split("-").map(Number);
      return (dy - cy) * 12 + (dm - cm) >= MAX_MONTHS_FORWARD;
    })();

  function toggleDay(day: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  function sortedSelected(): string[] {
    return Array.from(selected).sort();
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    setError(null);
    const dates = sortedSelected();
    if (dates.length === 0) {
      setError("Wybierz przynajmniej jeden dzień w kalendarzu.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/leaves/${editing.id}` : "/api/leaves",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: Number(employeeId),
            dates,
            note: note || null,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Nie udało się zapisać wniosku. Spróbuj ponownie.");
        return;
      }
      router.push("/leaves");
      router.refresh();
    } catch {
      setError("Błąd połączenia — wniosek nie został zapisany.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {editing ? "Edycja wniosku urlopowego" : "Nowy wniosek urlopowy"}
          </CardTitle>
          <CardDescription>
            Kliknij dzień, żeby go dodać — ponowny klik odznacza. Dni nie muszą
            być ciągłe (np. 2 i 4 grudnia bez 3-go = jeden wniosek z dwiema
            datami).
            {boss && !editing && " Widok szefa — wybierz pracownika."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {boss && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employee">Pracownik</Label>
              {editing ? (
                <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
                  {editing.employee_name}
                </div>
              ) : (
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger id="employee" className="w-full">
                    <SelectValue placeholder="Wybierz pracownika" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {displayName(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
            >
              ← Poprzedni
            </Button>
            <span className="text-sm font-medium capitalize">
              {monthLabel(monthKey)}
            </span>
            {atForwardLimit ? (
              <Button type="button" variant="outline" size="sm" disabled>
                Dalej →
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
              >
                Dalej →
              </Button>
            )}
          </div>

          <div>
            <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) {
                  return <div key={i} className="min-h-11 rounded-md bg-muted/30" />;
                }
                const isSelected = selected.has(day);
                const isToday = day === todayWarsaw();
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-md border text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : isToday
                          ? "border-primary bg-background"
                          : "border-border bg-background hover:bg-muted"
                    }`}
                    aria-pressed={isSelected}
                    aria-label={`Dzień ${Number(day.slice(8))}${isSelected ? " (zaznaczony)" : ""}`}
                  >
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {selected.size === 0
              ? "Nie wybrano żadnego dnia."
              : `Wybrane dni: ${sortedSelected().join(", ")}`}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Uwaga (opcjonalnie)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="np. urlop wypoczynkowy"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Zapisywanie…" : editing ? "Zapisz zmiany" : "Złóż wniosek"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/leaves">Anuluj</Link>
        </Button>
      </div>
    </form>
  );
}
