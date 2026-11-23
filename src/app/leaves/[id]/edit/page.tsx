import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { listLeaveRequestsForSession } from "@/lib/leaves";
import { requireSession } from "@/lib/auth";
import { MainNav } from "@/components/main-nav";
import LeaveDayPickerForm from "@/components/leave-request-form";

/**
 * Edycja WŁASNEGO oczekującego wniosku w tym samym kalendarzu dnia.
 * Zatwierdzony/odrzucony → brak edycji (redirect na listę; API dodatkowo
 * wymusza regułę w transakcji zapisu).
 */
async function EditLeaveForm({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const session = await requireSession();
  const { id } = await params;
  const leaveId = Number(id);
  if (!Number.isInteger(leaveId) || leaveId <= 0) notFound();

  const requests = await listLeaveRequestsForSession(session);
  const leave = requests.find((r) => r.id === leaveId);
  if (!leave) notFound();
  if (leave.status !== "pending") redirect("/leaves");

  return (
    <LeaveDayPickerForm
      boss={session.role === "boss"}
      editing={{
        id: leave.id,
        employee_id: leave.employee_id,
        employee_name: leave.employee_name,
        status: leave.status,
        dates: leave.dates,
        note: leave.note,
      }}
      employees={[]}
    />
  );
}

export default function EditLeavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
      <MainNav active="urlopy" />
      <h2 className="text-lg font-medium">Edytuj wniosek</h2>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <EditLeaveForm params={params} />
      </Suspense>
    </main>
  );
}
