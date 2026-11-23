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
  location_name?: string;
  requested_by_contact_id?: number | null;
  requested_by_name?: string | null;
  reports_count?: number;
}

/**
 * Zlecenie: numer nadaje serwer; wymagane: obiekt, osoba zlecająca
 * (kontakty WYBRANEGO obiektu), tytuł. Jeden kontakt może mieć kilka
 * aktywnych zleceń.
 * Edycja: zmiana obiektu możliwa zawsze, ale gdy zlecenie MA raporty —
 * tylko szef (blokada też po stronie API). Po zmianie obiektu poprzedni
 * zlecający jest czyszczony i pokazują się kontakty nowego obiektu.
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

  // „Dodaj zlecającego” inline — bez utraty wpisanego tytułu (formularz
  // nie jest resetowany; nowy kontakt od razu zaznaczany).
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  async function addContact() {
    if (contactSaving) return;
    setContactError(null);
    setContactSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: Number(locationId),
          full_name: newContactName,
          phone: newContactPhone || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setContactError(data?.error ?? "Nie udało się dodać kontaktu.");
        return;
      }
      const created = data.contact as { id: number; full_name: string };
      setContactId(String(created.id));
      setShowContactForm(false);
      setNewContactName("");
      setNewContactPhone("");
      router.refresh(); // odśwież listę kontaktów przekazaną z serwera
    } catch {
      setContactError("Błąd połączenia — kontakt nie został dodany.");
    } finally {
      setContactSaving(false);
    }
  }

  const hasReports = (editing?.reports_count ?? 0) > 0;
  const locationLocked = Boolean(editing?.id) && hasReports;

  // Kontakty zależą od wybranego obiektu; przy zmianie obiektu reset wyboru
  // (poprzedni zlecający nie przenosi się na nowy obiekt).
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
            ? hasReports
              ? "Zlecenie ma raporty — obiekt zmienia tylko szef."
              : "Obiekt i zlecającego może zmienić każdy; kontakty zależą od obiektu."
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
                setContactId(""); // zlecający czyszczony przy zmianie obiektu
              }}
              disabled={locationLocked}
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
            {locationLocked && (
              <p className="text-xs text-muted-foreground">
                Zlecenie ma raporty ({editing?.reports_count}) — zmiana obiektu
                wymaga konta szefa.
              </p>
            )}
            {editing?.id && !locationLocked && editing.location_name && (
              <p className="text-xs text-muted-foreground">
                Obecny obiekt: {editing.location_name}
                {editing.requested_by_name
                  ? ` · zlecający: ${editing.requested_by_name}`
                  : ""}
                {". "}Zmiana obiektu czyści zlecającego — wybierz kontakt
                nowego obiektu.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact">Zlecający (kontakt klienta)</Label>
            {locationContacts.length === 0 && !contactId ? (
              <p className="text-sm text-muted-foreground">
                Ten obiekt nie ma jeszcze kontaktów — dodaj osobę zlecającą
                poniżej.
              </p>
            ) : null}
            <div className="flex items-end gap-2">
              <div className="flex-1">
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
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowContactForm((v) => !v)}
              >
                {showContactForm ? "Ukryj" : "Dodaj zlecającego"}
              </Button>
            </div>

            {showContactForm && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-name">Imię i nazwisko</Label>
                  <Input
                    id="contact-name"
                    value={newContactName}
                    maxLength={120}
                    onChange={(e) => setNewContactName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-phone">Telefon (opcjonalnie)</Label>
                  <Input
                    id="contact-phone"
                    value={newContactPhone}
                    maxLength={40}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                  />
                </div>
                {contactError && (
                  <p role="alert" className="text-sm text-destructive">
                    {contactError}
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={!newContactName.trim() || contactSaving}
                  onClick={addContact}
                >
                  {contactSaving
                    ? "Dodawanie…"
                    : editing?.id
                      ? "Dodaj i przypisz"
                      : "Dodaj i zaznacz"}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Kontakt należy do wybranego obiektu; zmiana obiektu czyści wybór.
            </p>
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
