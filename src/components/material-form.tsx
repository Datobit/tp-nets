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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MaterialCreated {
  id: number;
  name: string;
  base_unit: string;
}

/**
 * Dodanie pozycji do wspólnego katalogu (nazwa + jednostka; bez cen
 * i zakupów). Tryb inline: zapis → przekaz materiału przez sessionStorage
 * → powrót do raportu z wybranym materiałem i zachowanym szkicem.
 */
export default function MaterialForm({ inline = false }: { inline?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [baseUnit, setBaseUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    setError(null);
    if (!name.trim()) {
      setError("Nazwa materiału jest wymagana.");
      return;
    }
    if (!baseUnit.trim()) {
      setError("Jednostka jest wymagana (np. szt., m).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, base_unit: baseUnit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Nie udało się dodać materiału.");
        return;
      }
      if (inline) {
        sessionStorage.setItem(
          "tp_nets_new_material",
          JSON.stringify(data.material)
        );
        router.refresh();
        router.back();
      } else {
        router.push("/reports/new");
        router.refresh();
      }
    } catch {
      setError("Błąd połączenia — materiał nie został dodany.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Nowy materiał</CardTitle>
        <CardDescription>
          Wspólny katalog — pozycja bez zakupu i ceny. Zakupy rejestruje
          szef osobno.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mat-name">Nazwa materiału</Label>
            <Input
              id="mat-name"
              placeholder="np. Czujka PIR"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mat-unit">Jednostka</Label>
            <Input
              id="mat-unit"
              placeholder="np. szt., m, kpl."
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Zapisywanie…" : "Dodaj materiał"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={inline ? "/reports/new" : "/reports/new"}>Anuluj</a>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
