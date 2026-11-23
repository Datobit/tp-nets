import { Suspense } from "react";
import { connection } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { MainNav } from "@/components/main-nav";
import OrderForm from "@/components/order-form";

async function OrderFormInner({
  searchParams,
}: {
  searchParams: Promise<{ inline?: string }>;
}) {
  await connection();
  await requireSession();
  const { inline } = await searchParams;
  const locations = await query<{ id: number; name: string; address: string }>(
    `SELECT id, name, address FROM locations ORDER BY name`
  );
  return <OrderForm inline={inline === "1"} locations={locations.rows} />;
}

export default function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ inline?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
      <MainNav active="zlecenia" />
      <h2 className="text-lg font-medium">Dodaj zlecenie</h2>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <OrderFormInner searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
