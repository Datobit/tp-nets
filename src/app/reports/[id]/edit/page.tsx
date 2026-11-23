import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getReportForSession } from "@/lib/reports";
import ReportEditForm from "@/components/report-edit-form";

/**
 * Edycja raportu: tylko autor. Monter dopisany do raportu widzi szczegóły,
 * ale nie może wejść w edycję (reguła sprawdzana też po stronie API).
 */
async function EditFormInner({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const session = await requireSession();
  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) notFound();

  const report = await getReportForSession(reportId, session);
  if (!report) notFound();

  // Autor: sprawdzamy po stronie serwera przed renderem formularza.
  const author = await query<{ created_by_user_id: number; deleted_at: Date | null }>(
    `SELECT created_by_user_id, deleted_at FROM work_reports WHERE id = $1`,
    [reportId]
  );
  if (author.rows.length === 0 || author.rows[0].deleted_at !== null) notFound();
  if (author.rows[0].created_by_user_id !== session.userId) {
    redirect(`/reports/${reportId}`);
  }

  const [employees, materials] = await Promise.all([
    query<{ id: number; first_name: string; last_name: string }>(
      `SELECT id, first_name, last_name FROM employees
       WHERE is_active AND can_be_assigned
       ORDER BY last_name, first_name`
    ),
    query<{ id: number; name: string; base_unit: string }>(
      `SELECT id, name, base_unit FROM materials WHERE is_active ORDER BY name`
    ),
  ]);

  // Monterzy raportu z id (do selektora edycji).
  const reportEmployees = await query<{
    employee_id: number;
    name: string;
    start_time: string;
    end_time: string;
  }>(
    `SELECT re.employee_id,
            (e.last_name || ' ' || e.first_name) AS name,
            to_char(re.start_time, 'HH24:MI') AS start_time,
            to_char(re.end_time, 'HH24:MI') AS end_time
     FROM report_employees re
     JOIN employees e ON e.id = re.employee_id
     WHERE re.work_report_id = $1
     ORDER BY e.last_name, e.first_name`,
    [reportId]
  );

  // Pozycje zużycia z id materiału (null = wpis własny, bez mapowania).
  const reportMaterials = await query<{
    material_id: number | null;
    name: string;
    used_qty: string;
    unit: string;
  }>(
    `SELECT rm.material_id,
            COALESCE(m.name, rm.custom_name) AS name,
            to_char(rm.used_qty, 'FM999999990.000') AS used_qty,
            rm.unit
     FROM report_materials rm
     LEFT JOIN materials m ON m.id = rm.material_id
     WHERE rm.work_report_id = $1
     ORDER BY rm.id`,
    [reportId]
  );

  return (
    <ReportEditForm
      report={{
        id: report.id,
        order_id: report.order_id,
        work_date: report.work_date,
        place_details: report.place_details,
        department: report.department,
        description: report.description,
        notes: report.notes,
        no_materials: report.no_materials,
        employees: reportEmployees.rows,
        materials: reportMaterials.rows,
      }}
      employees={employees.rows}
      materials={materials.rows}
    />
  );
}

export default function ReportEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-muted-foreground">
          ← Raporty
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <EditFormInner params={params} />
      </Suspense>
    </main>
  );
}
