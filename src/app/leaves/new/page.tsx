import { Suspense } from "react";
import { connection } from "next/server";
import { listEmployeesForSession } from "@/lib/leaves";
import { requireSession } from "@/lib/auth";
import { MainNav } from "@/components/main-nav";
import LeaveRequestForm from "@/components/leave-request-form";

async function NewLeaveForm() {
  await connection();
  const session = await requireSession();
  const employees = await listEmployeesForSession(session);
  return <LeaveRequestForm employees={employees} boss={session.role === "boss"} />;
}

export default function NewLeavePage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
      <MainNav active="urlopy" />
      <h2 className="text-lg font-medium">Nowy wniosek</h2>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <NewLeaveForm />
      </Suspense>
    </main>
  );
}
