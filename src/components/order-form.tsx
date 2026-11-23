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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface LocationOption {
  id: number;
  name: string;
  address: string;
}

/**
 * Tryb "inline" (z formularza raportu): zapis → powrót z wybranym
 * nowym zleceniem, bez utraty danych formularza raportu (router.back
 * + przekazanie id przez sessionStorage).
 */
export default function OrderForm({
  inline = false,
  locations,
}: {
  inline?: boolean;
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [locationId, setLocationId] = useState<string>(
    locations[0] ? String(locations[0].id) : ""
  );
  const [newLocationMode, setNewLocationMode] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    setError(null);
    if (!title.trim()) {
      setError("Nazwa zlecenia jest wymagana.");
      return;
    }
    if (newLocationMode && !newLocationName.trim()) {
      setError("Podaj nazwę nowego obiektu.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          location_id: newLocationMode ? null : Number(locationId),
          new_location: newLocationMode
            ? {
                name: newLocationName,
                address: newLocationAddress.trim() || null,
              }
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Nie udało się dodać zlecenia.");
        return;
      }
      if (inline) {
        // przekaz nowego zlecenia do formularza raportu i powrót
        sessionStorage.setItem("tp_nets_new_order", String(data.id));
        router.refresh(); // odśwież RSC — nowy props orders po powrocie
        router.back();
      } else {
        router.push("/orders");
        router.refresh();
      }
    } catch {
      setError("Błąd połączenia — zlecenie nie zostało dodane.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={inline ? "w-full" : "w-full max-w-md"}>
      <CardHeader>
        <CardTitle>Nowe zlecenie</CardTitle>
        <CardDescription>
          {inline
            ? "Zapisz i wróć do raportu z wybranym zleceniem."
            : "Obiekt i adres dotyczą zlecenia; miejsce konkretnych robót ustala monter w raporcie."}
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
            <Label htmlFor="title">Nazwa zlecenia</Label>
            <Input
              id="title"
              placeholder="np. Wymiana oświetlenia hali C"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Obiekt</Label>
            {newLocationMode ? (
              <div className="flex flex-col gap-2">
                <Input
                  id="location"
                  placeholder="Nazwa obiektu (wymagana)"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  maxLength={200}
                />
                <Input
                  placeholder="Adres (opcjonalny)"
                  value={newLocationAddress}
                  onChange={(e) => setNewLocationAddress(e.target.value)}
                  maxLength={300}
                />
                {locations.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNewLocationMode(false)}
                  >
                    Wybierz z listy
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger id="location" className="w-full">
                    <SelectValue placeholder="Wybierz obiekt" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewLocationMode(true)}
                >
                  Nowy obiekt
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {newLocationMode
                ? "Obiekt zostanie dodany i przypisany do zlecenia."
                : "Zlecenie trafia pod wybrany obiekt — bez cichego przypisania."}
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Zapisywanie…" : "Dodaj zlecenie"}
            </Button>
            {!inline && (
              <Button type="button" variant="outline" asChild>
                <a href="/orders">Anuluj</a>
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
