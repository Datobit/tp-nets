"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface LeaveReviewItem {
  id: number;
  employee_name: string;
  start_date: string;
  end_date: string;
}

const dateFmt = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function fmt(date: string) {
  return dateFmt.format(new Date(date + "T00:00:00"));
}

export default function LeaveReviewQueue({ items }: { items: LeaveReviewItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: number, decision: "approve" | "reject") {
    if (busyId !== null) return;
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/leaves/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(
          data?.error ?? "Nie udało się zapisać decyzji. Spróbuj ponownie."
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Błąd połączenia — decyzja nie została zapisana.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brak oczekujących wniosków</CardTitle>
          <CardDescription>
            Kolejka decyzyjna jest pusta — wszystkie wnioski rozpatrzone.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{item.employee_name}</CardTitle>
            <CardDescription>
              {fmt(item.start_date)} — {fmt(item.end_date)} (daty włącznie)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              size="sm"
              disabled={busyId !== null}
              onClick={() => decide(item.id, "approve")}
            >
              Zatwierdź
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId !== null}
              onClick={() => decide(item.id, "reject")}
            >
              Odrzuć
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
