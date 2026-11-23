import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getOrderForEdit, listLocations, listActiveContacts } from "@/lib/orders";
import OrderForm from "@/components/order-form";

async function OrderEditInner({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireSession();
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();
  const order = await getOrderForEdit(orderId);
  if (!order) notFound();
  const [locations, contacts] = await Promise.all([
    listLocations(),
    listActiveContacts(),
  ]);
  return (
    <OrderForm
      locations={locations}
      contacts={contacts}
      editing={{
        id: order.id,
        order_number: order.order_number,
        title: order.title,
        location_id: order.location_id,
        requested_by_contact_id: order.requested_by_contact_id,
      }}
    />
  );
}

export default function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
      <h2 className="text-lg font-medium">Edytuj zlecenie</h2>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <OrderEditInner params={params} />
      </Suspense>
    </main>
  );
}
