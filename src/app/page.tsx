import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { listReportsForSession } from "@/lib/reports";
import { requireSession } from "@/lib/auth";
import { MainNav, BossAllReportsLink } from "@/components/main-nav";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const dateFmt = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function ReportCard({
  id,
  work_date,
  order_title,
  location_name,
  description,
  employees,
}: {
  id: number;
  work_date: string;
  order_title: string;
  location_name: string;
  description: string;
  employees: string[];
}) {
  return (
    <Link href={`/reports/${id}`} className="block">
      <Card className="py-4 transition-colors hover:bg-muted/50">
        <CardHeader className="pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle className="text-base">{order_title}</CardTitle>
            <CardDescription className="shrink-0 tabular-nums">
              {dateFmt.format(new Date(work_date + "T00:00:00"))}
            </CardDescription>
          </div>
          <CardDescription>
            {location_name}
            {employees.length > 0 && <>{" · "}{employees.join(", ")}</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-2 text-sm text-foreground/80">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

async function ReportList() {
  await connection();
  const session = await requireSession();
  const reports = await listReportsForSession(session);
  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brak raportów</CardTitle>
          <CardDescription>
            Utwórz pierwszy raport przyciskiem „Nowy raport”.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {reports.map((r) => (
        <li key={r.id}>
          <ReportCard
            id={r.id}
            work_date={r.work_date}
            order_title={r.order_title}
            location_name={r.location_name}
            description={r.description}
            employees={r.employees}
          />
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
        <LogoutButton />
      </div>
      <MainNav active="raporty" />
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <ReportsSection />
      </Suspense>
    </main>
  );
}

async function ReportsSection() {
  const session = await requireSession();
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Raporty</h2>
        <Button asChild size="sm">
          <Link href="/reports/new">Nowy raport</Link>
        </Button>
      </div>
      {session.role === "boss" && <BossAllReportsLink />}
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <ReportList />
      </Suspense>
    </>
  );
}
