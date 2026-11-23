"use client";

import { useEffect, useState } from "react";
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

export interface ContactOption {
  id: number;
  location_id: number;
  full_name: string;
  phone: string | null;
}

export interface OrderDefaults {
  id?: number;
  order_number?: string;
  title?: string;
  location_id?: number;
  requested_by_contact_id?: number | null;
}

/**
 * Zlecenie: numer nadaje serwer; wymagane: obiekt, osoba zlecająca
 * (kontakty WYBRANEGO obiektu), tytuł. Jeden kontakt może mieć kilka
 * aktywnych zleceń. W edycji: pracownik nie zmieni obiektu/zlecającego,
 * gdy zlecenie ma raporty (blokada też po stronie API).
 */
export default function OrderForm({
  locations,
  contacts,
  editing,
}: {
  locations: LocationOption[];
  contacts: ContactOption[];
  editing?: OrderDefaults | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [locationId, setLocationId] = useState<string>(
    editing?.location_id
      ? String(editing.location_id)
      : locations[0]
        ? String(locations[0].id)
        : ""
  );
  const [contactId, setContactId] = useState<string>(
    editing?.requested_by_contact_id
      ? String(editing.requested_by_contact_id)
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Kontakty zależą od wybranego obiektu; przy zmianie obiektu reset wyboru.
  const locationContacts = contacts.filter(
    (c) => c.location_id === Number(locationId)
  );
  useEffect(() => {
    if (
      contactId &&
      !locationContacts.some((c) => String(c.id) === contactId)
    ) {
      setContactId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    setError(null);
    if (!title.trim()) {
      setError("Tytuł zlecenia jest wymagany.");
      return;
    }
    if (!contactId) {
      setError("Wybierz osobę zlecającą z kontaktów obiektu.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editing?.id ? `/api/orders/${editing.id}/edit` : "/api/orders",
        {
          method: editing?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            location_id: Number(locationId),
            requested_by_contact_id: Number(contactId),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Nie udało się zapisać zlecenia.");
        return;
      }
      router.push("/orders");
      router.refresh();
    } catch {
      setError("Błąd połączenia — zlecenie nie zostało zapisane.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {editing?.id
            ? `Edycja zlecenia ${editing.order_number ?? ""}`
            : "Nowe zlecenie"}
        </CardTitle>
        <CardDescription>
          {editing?.id
            ? "Jeśli zlecenie ma raporty, obiekt i zlecającego zmienia tylko szef."
            : "Numer zlecenia nadamy automatycznie. Obiekt i osoba zlecająca są wymagane."}
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
            <Label htmlFor="title">Tytuł zlecenia</Label>
            <Input
              id="title"
              placeholder="np. Ładowarka przy wejściu nr 20"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Obiekt</Label>
            <Select
              value={locationId}
              onValueChange={(v) => {
                setLocationId(v);
                setContactId("");
              }}
              disabled={Boolean(editing?.id)}
            >
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact">Osoba zlecająca (kontakt obiektu)</Label>
            {locationContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ten obiekt nie ma jeszcze kontaktów — poproś szefa o dodanie.
              </p>
            ) : (
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger id="contact" className="w-full">
                  <SelectValue placeholder="Wybierz osobę zlecającą" />
                </SelectTrigger>
                <SelectContent>
                  {locationContacts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.full_name}
                      {c.phone ? ` (${c.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving || !contactId}>
              {saving ? "Zapisywanie…" : editing?.id ? "Zapisz zmiany" : "Dodaj zlecenie"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href="/orders">Anuluj</a>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
