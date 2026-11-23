import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  listOrders,
  listAssignableEmployees,
  listActiveMaterials,
} from "@/lib/reports";
import ReportForm from "@/components/report-form";

async function NewReportForm() {
  await connection();
  const [orders, employees, materials] = await Promise.all([
    listOrders(),
    listAssignableEmployees(),
    listActiveMaterials(),
  ]);
  return (
    <ReportForm orders={orders} employees={employees} materials={materials} />
  );
}

export default function NewReportPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-muted-foreground">
          ← Raporty
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Nowy raport</h1>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <NewReportForm />
      </Suspense>
    </main>
  );
}
