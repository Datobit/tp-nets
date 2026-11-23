"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LocationRow } from "@/app/locations/page";

/**
 * Obiekty: dodawanie i edycja (nazwa, adres). Edycja nazwy obiektu, który
 * ma już zlecenia/raporty, zmienia tę nazwę w całej historii — dlatego
 * wymaga potwierdzenia.
 */
export default function LocationsManager({
  locations,
}: {
  locations: LocationRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [showNew, setShowNew] = useState(false);

  const [editRows, setEditRows] = useState<
    Record<number, { name: string; address: string }>
  >({});
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function send(url: string, method: string, body?: unknown) {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setError(data?.error ?? "Operacja nie powiodła się.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function addLocation() {
    if (busyId) return;
    setBusyId("new");
    try {
      const ok = await send("/api/locations", "POST", {
        name: newName,
        address: newAddress,
      });
      if (ok) {
        setNewName("");
        setNewAddress("");
        setShowNew(false);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveLocation(id: number, hasHistory: boolean) {
    const row = editRows[id];
    if (!row || busyId) return;

    // Nazwa obiektu z historią: potwierdzenie przed zapisem.
    if (hasHistory && !confirmId) {
      setConfirmId(id);
      return;
    }

    setBusyId(`l${id}`);
    try {
      const ok = await send(`/api/locations/${id}`, "PATCH", {
        name: row.name,
        address: row.address,
      });
      if (ok) {
        setEditRows((r) => {
          const next = { ...r };
          delete next[id];
          return next;
        });
        setConfirmId(null);
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Button
        variant={showNew ? "outline" : "default"}
        onClick={() => setShowNew((v) => !v)}
      >
        {showNew ? "Ukryj formularz" : "Dodaj obiekt"}
      </Button>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>Nowy obiekt</CardTitle>
            <CardDescription>
              Nazwa wymagana; adres opcjonalny. Kontakty (osoby zlecające)
              dodasz po utworzeniu obiektu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc-name">Nazwa</Label>
              <Input
                id="loc-name"
                value={newName}
                maxLength={200}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc-address">Adres</Label>
              <Input
                id="loc-address"
                value={newAddress}
                maxLength={300}
                placeholder="opcjonalny"
                onChange={(e) => setNewAddress(e.target.value)}
              />
            </div>
            <Button
              disabled={!newName.trim() || busyId === "new"}
              onClick={addLocation}
            >
              {busyId === "new" ? "Dodawanie…" : "Dodaj obiekt"}
            </Button>
          </CardContent>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {locations.map((l) => {
          const edit = editRows[l.id];
          const hasHistory = l.orders_count > 0 || l.reports_count > 0;
          return (
            <li key={l.id}>
              <Card className="py-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{l.name}</CardTitle>
                  <CardDescription>
                    {l.address} · zlecenia: {l.orders_count} · raporty:{" "}
                    {l.reports_count}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {edit ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1.5">
                          <Label>Nazwa</Label>
                          <Input
                            value={edit.name}
                            maxLength={200}
                            onChange={(e) =>
                              setEditRows((r) => ({
                                ...r,
                                [l.id]: { ...edit, name: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Adres</Label>
                          <Input
                            value={edit.address}
                            maxLength={300}
                            onChange={(e) =>
                              setEditRows((r) => ({
                                ...r,
                                [l.id]: { ...edit, address: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                      {confirmId === l.id && hasHistory && (
                        <p className="text-sm text-destructive">
                          Ten obiekt ma zlecenia/raporty — zmiana nazwy pokaże
                          się w całej historii. Zapisać?
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busyId === `l${l.id}` || !edit.name.trim()}
                          onClick={() => saveLocation(l.id, hasHistory)}
                        >
                          {confirmId === l.id ? "Tak, zapisz" : "Zapisz"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditRows((r) => {
                              const next = { ...r };
                              delete next[l.id];
                              return next;
                            });
                            setConfirmId(null);
                          }}
                        >
                          Anuluj
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditRows((r) => ({
                          ...r,
                          [l.id]: { name: l.name, address: l.address },
                        }))
                      }
                    >
                      Edytuj obiekt
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
