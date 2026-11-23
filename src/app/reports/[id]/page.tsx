import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getReportForSession } from "@/lib/reports";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { DeleteReportButton, RestoreReportButton } from "@/components/report-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const dateFmt = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

async function ReportDetails({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const session = await requireSession();
  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) notFound();
  const report = await getReportForSession(reportId, session);
  if (!report) notFound();

  // Stan raportu i uprawnienia akcji: autor edytuje/usuwa swoje; szef
  // przywraca usunięte. Monter dopisany do raportu — tylko podgląd.
  const meta = await query<{
    created_by_user_id: number;
    deleted_at: Date | null;
  }>(`SELECT created_by_user_id, deleted_at FROM work_reports WHERE id = $1`, [
    reportId,
  ]);
  if (meta.rows.length === 0) notFound();
  const isAuthor = meta.rows[0].created_by_user_id === session.userId;
  const isDeleted = meta.rows[0].deleted_at !== null;
  const isBoss = session.role === "boss";

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Protokół prac #{report.id}
        </h1>
        {isDeleted && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
            usunięty
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{report.order_title}</CardTitle>
          <CardDescription>
            {report.location_name} · {report.location_address}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Obiekt: </span>
            {report.location_name}
            {report.location_address ? `, ${report.location_address}` : ""}
          </p>
          <p>
            <span className="text-muted-foreground">Data prac: </span>
            {dateFmt.format(new Date(report.work_date + "T00:00:00"))}
          </p>
          {report.department && (
            <p>
              <span className="text-muted-foreground">Dział: </span>
              {report.department}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Miejsce prac: </span>
            {report.place_details ?? "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monterzy (ekipa)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 text-sm">
            {report.employees.map((e) => (
              <li key={e.name} className="flex justify-between">
                <span>{e.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {e.start_time}–{e.end_time}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wykonana praca</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm whitespace-pre-line">
          <p>{report.description}</p>
          {report.notes && (
            <p>
              <span className="text-muted-foreground">Uwagi: </span>
              {report.notes}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zużyte materiały</CardTitle>
        </CardHeader>
        <CardContent>
          {report.no_materials || report.materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nie zużyto materiałów.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {report.materials.map((m, i) => (
                <li key={i} className="flex justify-between">
                  <span>{m.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {m.used_qty} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAuthor && !isDeleted && (
        <Card>
          <CardHeader>
            <CardTitle>Akcje</CardTitle>
            <CardDescription>
              Jako autor możesz poprawić ten raport albo go usunąć.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/reports/${reportId}/edit`}>Edytuj raport</Link>
              </Button>
            </div>
            <DeleteReportButton reportId={reportId} />
          </CardContent>
        </Card>
      )}

      {isBoss && isDeleted && (
        <Card>
          <CardHeader>
            <CardTitle>Raport usunięty</CardTitle>
            <CardDescription>Możesz go przywrócić.</CardDescription>
          </CardHeader>
          <CardContent>
            <RestoreReportButton reportId={reportId} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function ReportDetailPage({
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
        <ReportDetails params={params} />
      </Suspense>
    </main>
  );
}
