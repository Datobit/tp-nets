import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { listLeaveRequestsForSession } from "@/lib/leaves";
import { requireSession } from "@/lib/auth";
import { MainNav } from "@/components/main-nav";
import LeaveReviewQueue from "@/components/leave-review-queue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function ReviewContent() {
  await connection();
  const session = await requireSession();
  if (session.role !== "boss") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brak uprawnień</CardTitle>
          <CardDescription>
            Wnioski rozpatruje wyłącznie szef.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const requests = await listLeaveRequestsForSession(session);
  const pending = requests.filter((lr) => lr.status === "pending");
  return <LeaveReviewQueue items={pending} />;
}

export default function LeaveReviewPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
      <MainNav active="urlopy" />
      <div className="flex items-center gap-3">
        <Link href="/leaves" className="text-sm text-muted-foreground">
          ← Urlopy
        </Link>
      </div>
      <h2 className="text-lg font-medium">Decyzje kierownika</h2>
      <Card>
        <CardHeader>
          <CardDescription>
            Widok dostępny tylko dla szefa — rozpatrywanie wniosków.
          </CardDescription>
        </CardHeader>
      </Card>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <ReviewContent />
      </Suspense>
    </main>
  );
}
