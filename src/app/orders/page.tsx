import { Suspense } from "react";
import { connection } from "next/server";
import { listOrdersForView } from "@/lib/orders";
import { requireSession } from "@/lib/auth";
import { MainNav } from "@/components/main-nav";
import { LogoutButton } from "@/components/logout-button";
import { BossOrderActions } from "@/components/boss-order-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  new: "Nowe",
  in_progress: "W toku",
  done: "Zamknięte",
};

async function OrdersList() {
  await connection();
  const session = await requireSession();
  const orders = await listOrdersForView();

  return (
    <ul className="flex flex-col gap-3">
      {orders.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Brak zleceń</CardTitle>
            <CardDescription>
              Dodaj pierwsze zlecenie przyciskiem „Dodaj zlecenie”.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {orders.map((o) => (
        <li key={o.id}>
          <Card className="py-4">
            <CardHeader className="pb-2">
              <div className="flex items-baseline justify-between gap-2">
                <CardTitle className="text-base">{o.title}</CardTitle>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    o.status === "done"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {STATUS_LABELS[o.status]}
                </span>
              </div>
              <CardDescription>
                {o.location_name} · {o.location_address}
                {o.department ? ` · ${o.department}` : ""}
              </CardDescription>
            </CardHeader>
            {session.role === "boss" && o.status !== "done" && (
              <CardContent>
                <BossOrderActions orderId={o.id} currentTitle={o.title} />
              </CardContent>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function OrdersPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
        <LogoutButton />
      </div>
      <MainNav active="zlecenia" />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Zlecenia</h2>
        <Button asChild size="sm">
          <a href="/orders/new">Dodaj zlecenie</a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Zamknięte zlecenia nie pojawiają się w nowych raportach, ale zostają
        w historii. Nazwę i zamknięcie zmienia tylko szef (wymuszone na serwerze).
      </p>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <OrdersList />
      </Suspense>
    </main>
  );
}
