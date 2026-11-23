"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EmployeeBasic {
  id: number;
  first_name: string;
  last_name: string;
}

/** Osoby demo mają techniczne nazwisko „Demo” — pokazujemy samo imię. */
export function displayName(e: { first_name: string; last_name: string }) {
  return e.last_name === "Demo" ? e.first_name : `${e.last_name} ${e.first_name}`;
}

export default function LeaveRequestForm({
  employees,
  boss = false,
}: {
  employees: EmployeeBasic[];
  boss?: boolean;
}) {
  const router = useRouter();

  const [employeeId, setEmployeeId] = useState<string>(
    employees[0] ? String(employees[0].id) : ""
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    setError(null);

    if (!startDate || !endDate) {
      setError("Podaj obie daty: „od” i „do”.");
      return;
    }
    if (endDate < startDate) {
      setError("Data „do” nie może być wcześniejsza niż data „od”.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(employeeId),
          start_date: startDate,
          end_date: endDate,
          note: note || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Nie udało się zapisać wniosku. Spróbuj ponownie.");
        return;
      }
      router.push("/leaves");
      router.refresh();
    } catch {
      setError("Błąd połączenia — wniosek nie został zapisany.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nowy wniosek urlopowy</CardTitle>
          <CardDescription>
            {boss
              ? "Widok szefa — wybierz pracownika."
              : "Wniosek składany na Ciebie (z sesji)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee">Pracownik</Label>
            {boss ? (
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger id="employee" className="w-full">
                  <SelectValue placeholder="Wybierz pracownika" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {displayName(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
                {employees[0] ? displayName(employees[0]) : "Konto bez pracownika"}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start-date">Od (włącznie)</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end-date">Do (włącznie)</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Uwaga (opcjonalnie)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="np. urlop wypoczynkowy"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Zapisywanie…" : "Złóż wniosek"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/leaves">Anuluj</Link>
        </Button>
      </div>
    </form>
  );
}
