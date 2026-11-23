import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  listApprovedLeavesForMonth,
  listLeaveRequestsForSession,
} from "@/lib/leaves";
import { requireSession } from "@/lib/auth";
import { MainNav } from "@/components/main-nav";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import LeaveCalendar from "@/components/leave-calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const dateFmt = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function fmt(date: string) {
  return dateFmt.format(new Date(date + "T00:00:00"));
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Oczekuje",
  approved: "Zatwierdzony",
  rejected: "Odrzucony",
};

const MAX_MONTHS_FORWARD = 6; // w listopadzie 2026 ostatni dostępny: maj 2027

function todayWarsaw(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

/** Klucz miesiąca YYYY-MM (Europe/Warsaw). */
function currentMonthKey(): string {
  return todayWarsaw().slice(0, 7);
}

function monthKeyValid(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

/** Różnica w miesiącach: displayed - current. Dodatnia = przyszłość. */
function monthsDiff(displayed: string, current: string): number {
  const [dy, dm] = displayed.split("-").map(Number);
  const [cy, cm] = current.split("-").map(Number);
  return (dy - cy) * 12 + (dm - cm);
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

function monthBounds(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function LeavesContent({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  await connection();
  const session = await requireSession();
  const { m: monthParam } = await searchParams;

  const currentKey = currentMonthKey();
  // monthKeyValid akceptuje wyłącznie poprawny YYYY-MM; fallback na bieżący
  // miesiąc również gdy parametru brak (undefined) — nigdy undefined dalej.
  const displayedKey =
    monthParam && monthKeyValid(monthParam) ? monthParam : currentKey;
  const diff = monthsDiff(displayedKey, currentKey);

  // Przeglądanie maksymalnie 6 miesięcy w przód; wstecz bez nowego limitu.
  const forward = Math.max(diff, 0);
  const clampedKey = forward > MAX_MONTHS_FORWARD ? shiftMonthKey(currentKey, MAX_MONTHS_FORWARD) : displayedKey;

  const bounds = monthBounds(clampedKey);

  let leaves: Awaited<ReturnType<typeof listApprovedLeavesForMonth>> = [];
  let loadError: string | null = null;
  try {
    leaves = await listApprovedLeavesForMonth(bounds.start, bounds.end);
  } catch {
    loadError = "Nie udało się pobrać urlopów dla tego miesiąca.";
  }

  const requests = await listLeaveRequestsForSession(session);
  const isCurrent = clampedKey === currentKey;
  const atForwardLimit = monthsDiff(clampedKey, currentKey) >= MAX_MONTHS_FORWARD;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium capitalize">
          {monthLabel(clampedKey)}
        </h2>
        <Button asChild size="sm">
          <Link href="/leaves/new">Nowy wniosek</Link>
        </Button>
      </div>
      {session.role === "boss" && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/leaves/review">Rozpatrz wnioski</Link>
        </Button>
      )}

      <Card>
        <CardContent className="flex items-center justify-between gap-2 py-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/leaves?m=${shiftMonthKey(clampedKey, -1)}`}>
              ← Poprzedni
            </Link>
          </Button>
          {!isCurrent && (
            <Button asChild variant="outline" size="sm">
              <Link href="/leaves">Dzisiaj</Link>
            </Button>
          )}
          {atForwardLimit ? (
            <Button variant="outline" size="sm" disabled aria-disabled="true">
              Dalej →
            </Button>
            ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leaves?m=${shiftMonthKey(clampedKey, 1)}`}>
                Dalej →
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {loadError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {loadError}
        </div>
      )}

      {!loadError && (
        <LeaveCalendar leaves={leaves} monthKey={clampedKey} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          {session.role === "boss" ? "Wnioski urlopowe" : "Moje wnioski"}
        </h2>
        {requests.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Brak wniosków</CardTitle>
              <CardDescription>
                Złóż wniosek przyciskiem „Nowy wniosek”.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((lr) => (
              <li key={lr.id}>
                <Card className="py-4">
                  <CardHeader className="pb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <CardTitle className="text-base">
                        {lr.employee_name}
                      </CardTitle>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          lr.status === "approved"
                            ? "bg-primary/15 text-primary"
                            : lr.status === "pending"
                              ? "bg-muted text-muted-foreground"
                              : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {STATUS_LABELS[lr.status]}
                      </span>
                    </div>
                    <CardDescription>
                      {fmt(lr.start_date)} — {fmt(lr.end_date)} (daty włącznie)
                    </CardDescription>
                  </CardHeader>
                  {lr.note && (
                    <CardContent>
                      <p className="text-sm text-foreground/80">{lr.note}</p>
                    </CardContent>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
        <LogoutButton />
      </div>
      <MainNav active="urlopy" />
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <LeavesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
