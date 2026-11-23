import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  listBossLocations,
  listBossContacts,
  listBossOrders,
  listBossReports,
  listUnassignedReports,
  type BossLocation,
  type BossContact,
  type BossOrder,
} from "@/lib/reports";
import { MainNav } from "@/components/main-nav";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
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

const STATUS_LABELS: Record<string, string> = {
  new: "Nowe",
  in_progress: "W toku",
  done: "Zamknięte",
};

/**
 * „Wszystkie raporty” — sekcja TYLKO dla szefa. Ścieżka: Obiekt → Zlecający
 * → Zlecenie (aktywne i zakończone) → Raporty. Raporty bez pewnego
 * powiązania (stare zlecenia bez osoby zlecającej) — „Do przypisania”,
 * bez automatycznego dopasowywania.
 */
async function AllReportsContent({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; contact?: string; order?: string }>;
}) {
  await connection();
  const session = await requireSession();
  if (session.role !== "boss") redirect("/");

  const { location, contact, order } = await searchParams;
  const locationId = Number(location);
  const contactId = Number(contact);
  const orderId = Number(order);

  // Poziom 1: obiekty
  if (!location || !Number.isInteger(locationId) || locationId <= 0) {
    const locations = await listBossLocations();
    return (
      <>
        <h2 className="text-lg font-medium">Obiekty</h2>
        {locations.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Brak obiektów.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {locations.map((l: BossLocation) => (
              <li key={l.id}>
                <Link href={`/reports/all?location=${l.id}`} className="block">
                  <Card className="py-4 transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <CardTitle className="text-base">{l.name}</CardTitle>
                        <CardDescription className="shrink-0 tabular-nums">
                          {l.reports_count} rap.
                        </CardDescription>
                      </div>
                      <CardDescription>{l.address}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  // Poziom 2: zlecający obiektu
  if (!contact || !Number.isInteger(contactId) || contactId <= 0) {
    const contacts = await listBossContacts(locationId);
    return (
      <>
        <p className="text-sm text-muted-foreground">
          <Link href="/reports/all" className="underline">Obiekty</Link> → zlecający
        </p>
        {contacts.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Ten obiekt nie ma jeszcze kontaktów — raporty trafią do
              „Do przypisania”.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {contacts.map((c: BossContact) => (
              <li key={c.id}>
                <Link
                  href={`/reports/all?location=${locationId}&contact=${c.id}`}
                  className="block"
                >
                  <Card className="py-4 transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <CardTitle className="text-base">{c.full_name}</CardTitle>
                        <CardDescription className="shrink-0 tabular-nums">
                          {c.reports_count} rap.
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  // Poziom 3: zlecenia zlecającego — aktywne i zakończone
  if (!order || !Number.isInteger(orderId) || orderId <= 0) {
    const orders = await listBossOrders(contactId);
    const active = orders.filter((o) => o.status !== "done");
    const done = orders.filter((o) => o.status === "done");
    return (
      <>
        <p className="text-sm text-muted-foreground">
          <Link href="/reports/all" className="underline">Obiekty</Link> →{" "}
          <Link href={`/reports/all?location=${locationId}`} className="underline">
            zlecający
          </Link>{" "}
          → zlecenia
        </p>
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Brak zleceń tej osoby.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {[["Aktywne zlecenia", active], ["Zakończone", done]].map(
              ([label, list]) =>
                (list as BossOrder[]).length > 0 && (
                  <section key={String(label)} className="flex flex-col gap-3">
                    <h3 className="text-sm font-medium">{String(label)}</h3>
                    <ul className="flex flex-col gap-3">
                      {(list as BossOrder[]).map((o) => (
                        <li key={o.id}>
                          <Link
                            href={`/reports/all?location=${locationId}&contact=${contactId}&order=${o.id}`}
                            className="block"
                          >
                            <Card className="py-4 transition-colors hover:bg-muted/50">
                              <CardHeader className="pb-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <CardTitle className="text-base">
                                    <span className="tabular-nums text-muted-foreground">
                                      {o.order_number}
                                    </span>{" "}
                                    {o.title}
                                  </CardTitle>
                                  <CardDescription className="shrink-0 tabular-nums">
                                    {o.reports_count} rap.
                                  </CardDescription>
                                </div>
                                <CardDescription>
                                  {STATUS_LABELS[o.status]}
                                </CardDescription>
                              </CardHeader>
                            </Card>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
            )}
          </div>
        )}
      </>
    );
  }

  // Poziom 4: raporty zlecenia (usunięte widoczne u szefa, oznaczone)
  const reports = await listBossReports(orderId);
  return (
    <>
      <p className="text-sm text-muted-foreground">
        <Link href="/reports/all" className="underline">Obiekty</Link> →{" "}
        <Link href={`/reports/all?location=${locationId}`} className="underline">
          zlecający
        </Link>{" "}
        →{" "}
        <Link
          href={`/reports/all?location=${locationId}&contact=${contactId}`}
          className="underline"
        >
          zlecenia
        </Link>{" "}
        → raporty
      </p>
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Brak raportów tego zlecenia.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/reports/${r.id}`} className="block">
                <Card
                  className={`py-4 ${r.deleted ? "opacity-60" : "transition-colors hover:bg-muted/50"}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <CardTitle className="text-base">
                        {dateFmt.format(new Date(r.work_date + "T00:00:00"))}
                        {r.deleted && (
                          <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                            usunięty
                          </span>
                        )}
                      </CardTitle>
                      {r.employees.length > 0 && (
                        <CardDescription className="shrink-0">
                          {r.employees.join(", ")}
                        </CardDescription>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-foreground/80">
                      {r.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AllReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; contact?: string; order?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Wszystkie raporty</h1>
        <LogoutButton />
      </div>
      <MainNav active="wszystkie" />
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <AllReportsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
