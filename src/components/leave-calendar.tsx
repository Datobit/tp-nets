"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface CalendarLeave {
  id: number;
  employee_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

function todayWarsaw(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

/** Komórki kalendarza: null = dzień z poprzedniego/następnego miesiąca. */
function buildCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // poniedziałek = 0
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

export default function LeaveCalendar({
  leaves,
  monthKey,
}: {
  /** Urlopy zatwierdzone nachodzące na wyświetlany miesiąc (dane z serwera). */
  leaves: CalendarLeave[];
  /** Wyświetlany miesiąc jako YYYY-MM. */
  monthKey: string;
}) {
  const today = todayWarsaw();
  // Obrona w głębi: props zawsze poprawny YYYY-MM (normalnie gwarantuje
  // strona serwerowa); przy niezgodności fallback na bieżący miesiąc,
  // bez ścieżki, w której split dostaje undefined.
  const safeKey = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey ?? "")
    ? monthKey
    : today.slice(0, 7);
  const [year, month] = useMemo(
    () => safeKey.split("-").map(Number) as [number, number],
    [safeKey]
  );

  const cells = useMemo(
    () => buildCells(year, month - 1),
    [year, month]
  );

  // Mapa dzień -> urlopy obejmujące ten dzień (wspólny zbiór z komunikatem).
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarLeave[]>();
    for (const lv of leaves) {
      for (let d = lv.start_date; d <= lv.end_date; ) {
        const cur = map.get(d) ?? [];
        cur.push(lv);
        map.set(d, cur);
        // następny dzień kalendarzowy (UTC, bez czasu lokalnego)
        const dt = new Date(d + "T00:00:00Z");
        dt.setUTCDate(dt.getUTCDate() + 1);
        d = dt.toISOString().slice(0, 10);
      }
    }
    return map;
  }, [leaves]);

  const monthLeaves = leaves;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Zatwierdzone urlopy</CardTitle>
        <CardDescription>
          Kto jest nieobecny w danym dniu (bez uwag do wniosków).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
              const dayLeaves = byDay.get(day) ?? [];
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={`flex min-h-11 flex-col rounded-md border p-1 ${
                    isToday ? "border-primary" : "border-border"
                  } ${dayLeaves.length > 0 ? "bg-primary/10" : ""}`}
                >
                  <span className="text-xs tabular-nums">{Number(day.slice(8))}</span>
                  {dayLeaves.slice(0, 2).map((lv) => (
                    <span
                      key={lv.id}
                      className="truncate text-[10px] leading-tight text-foreground/80"
                      title={lv.employee_name}
                    >
                      {lv.employee_name}
                    </span>
                  ))}
                  {dayLeaves.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{dayLeaves.length - 2}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="pb-1 text-sm font-medium">Urlopy w tym miesiącu</h3>
          {monthLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Brak zatwierdzonych urlopów w tym miesiącu.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {monthLeaves.map((lv) => (
                <li key={lv.id} className="flex justify-between text-sm">
                  <span>{lv.employee_name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {lv.start_date} — {lv.end_date}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
