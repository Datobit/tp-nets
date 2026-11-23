import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth";
import { listLocations, listActiveContacts } from "@/lib/orders";
import OrderForm from "@/components/order-form";

async function OrderFormInner() {
  await connection();
  await requireSession();
  const [locations, contacts] = await Promise.all([
    listLocations(),
    listActiveContacts(),
  ]);
  return <OrderForm locations={locations} contacts={contacts} />;
}

export default function NewOrderPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
      <h2 className="text-lg font-medium">Dodaj zlecenie</h2>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <OrderFormInner />
      </Suspense>
    </main>
  );
}
