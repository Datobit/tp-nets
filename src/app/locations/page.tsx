import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { MainNav } from "@/components/main-nav";
import { LogoutButton } from "@/components/logout-button";
import LocationsManager from "@/components/locations-manager";

export interface LocationRow {
  id: number;
  name: string;
  address: string;
  orders_count: number;
  reports_count: number;
}

async function LocationsInner() {
  await connection();
  await requireSession();
  const rows = await query<LocationRow>(
    `SELECT l.id, l.name, l.address,
            (SELECT count(*) FROM orders o WHERE o.location_id = l.id) AS orders_count,
            (SELECT count(*) FROM work_reports r
             JOIN orders o ON o.id = r.order_id
             WHERE o.location_id = l.id AND r.deleted_at IS NULL) AS reports_count
     FROM locations l
     ORDER BY l.name`
  );
  return <LocationsManager locations={rows.rows} />;
}

export default function LocationsPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Obiekty</h1>
        <LogoutButton />
      </div>
      <MainNav active="obiekty" />
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <LocationsInner />
      </Suspense>
    </main>
  );
}
