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

export interface MaterialRow {
  id: number;
  name: string;
  base_unit: string;
  is_active: boolean;
  purchases_count: number;
  usage_count: number;
}

export interface PurchaseRow {
  id: number;
  material_id: number;
  material_name: string;
  purchase_date: string;
  purchased_qty: string;
  unit: string;
  total_price_net: string;
  buyer_name: string | null;
}

export interface UsageRow {
  id: number;
  report_id: number;
  work_date: string;
  material_name: string;
  used_qty: string;
  unit: string;
  has_cost: boolean;
}

/**
 * Zakładka Materiały — trzy widoki. Zużycie edytowane tu i w raporcie to
 * TEN SAM wpis (report_materials); jednostka katalogowa to podpowiedź.
 * Brak ceny ≠ 0 zł (koszt po akceptacji szefa).
 */
export default function MaterialViews({
  view,
  materials,
  purchases,
  usage,
}: {
  view: "catalog" | "purchases" | "usage";
  materials: MaterialRow[];
  purchases: PurchaseRow[];
  usage: UsageRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Formularz katalogu: nowy materiał
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");

  // Edycja wierszy katalogu (lokalny stan)
  const [editRows, setEditRows] = useState<
    Record<number, { name: string; base_unit: string }>
  >({});

  // Edycja zakupów
  const [purchaseRows, setPurchaseRows] = useState<
    Record<number, { purchased_qty: string; unit: string; total_price_net: string; buyer_name: string }>
  >({});

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

  async function addMaterial() {
    if (busyId) return;
    setBusyId("new");
    try {
      const ok = await send("/api/materials", "POST", {
        name: newName,
        base_unit: newUnit,
      });
      if (ok) {
        setNewName("");
        setNewUnit("");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveMaterial(id: number) {
    const row = editRows[id];
    if (!row || busyId) return;
    setBusyId(`m${id}`);
    try {
      await send(`/api/materials/${id}`, "PATCH", {
        name: row.name,
        base_unit: row.base_unit,
      });
      setEditRows((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleMaterialActive(m: MaterialRow) {
    if (busyId) return;
    setBusyId(`a${m.id}`);
    try {
      await send(`/api/materials/${m.id}`, "PATCH", { is_active: !m.is_active });
    } finally {
      setBusyId(null);
    }
  }

  async function savePurchase(id: number) {
    const row = purchaseRows[id];
    if (!row || busyId) return;
    setBusyId(`p${id}`);
    try {
      await send(`/api/materials/purchases/${id}`, "PATCH", {
        purchased_qty: Number(row.purchased_qty.replace(",", ".")),
        unit: row.unit,
        total_price_net: Number(row.total_price_net.replace(",", ".")),
        buyer_name: row.buyer_name,
      });
      setPurchaseRows((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  if (view === "catalog") {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Dodaj materiał</CardTitle>
            <CardDescription>
              Nazwa i jednostka DOMYŚLNA (podpowiedź przy zużyciu — można
              zapisać inną jednostkę, np. 0,5 paczki zamiast szt.).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-name">Nazwa</Label>
              <Input
                id="new-name"
                value={newName}
                maxLength={200}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-unit">Jednostka domyślna</Label>
              <Input
                id="new-unit"
                value={newUnit}
                maxLength={20}
                placeholder="np. szt., m, paczka"
                onChange={(e) => setNewUnit(e.target.value)}
              />
            </div>
            <Button
              disabled={!newName.trim() || !newUnit.trim() || busyId === "new"}
              onClick={addMaterial}
            >
              {busyId === "new" ? "Dodawanie…" : "Dodaj do katalogu"}
            </Button>
          </CardContent>
        </Card>

        <ul className="flex flex-col gap-3">
          {materials.map((m) => {
            const edit = editRows[m.id];
            return (
              <li key={m.id}>
                <Card className={`py-4 ${m.is_active ? "" : "opacity-70"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <CardTitle className="text-base">{m.name}</CardTitle>
                      <CardDescription className="shrink-0">
                        {!m.is_active && "wycofany · "}
                        jednostka: {m.base_unit}
                      </CardDescription>
                    </div>
                    <CardDescription>
                      zakupy: {m.purchases_count} · zużycia: {m.usage_count}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {edit ? (
                      <>
                        <div className="flex gap-2">
                          <Input
                            value={edit.name}
                            maxLength={200}
                            onChange={(e) =>
                              setEditRows((r) => ({
                                ...r,
                                [m.id]: { ...edit, name: e.target.value },
                              }))
                            }
                          />
                          <Input
                            className="w-28"
                            value={edit.base_unit}
                            maxLength={20}
                            onChange={(e) =>
                              setEditRows((r) => ({
                                ...r,
                                [m.id]: { ...edit, base_unit: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={busyId === `m${m.id}` || !edit.name.trim() || !edit.base_unit.trim()}
                            onClick={() => saveMaterial(m.id)}
                          >
                            Zapisz
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditRows((r) => {
                                const next = { ...r };
                                delete next[m.id];
                                return next;
                              })
                            }
                          >
                            Anuluj
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditRows((r) => ({
                              ...r,
                              [m.id]: { name: m.name, base_unit: m.base_unit },
                            }))
                          }
                        >
                          Zmień nazwę / jednostkę
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === `a${m.id}`}
                          onClick={() => toggleMaterialActive(m)}
                        >
                          {m.is_active ? "Wycofaj z wyboru" : "Przywróć do wyboru"}
                        </Button>
                      </div>
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

  if (view === "purchases") {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {purchases.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Brak zakupów.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {purchases.map((p) => {
              const edit = purchaseRows[p.id];
              return (
                <li key={p.id}>
                  <Card className="py-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{p.material_name}</CardTitle>
                      <CardDescription>
                        {p.purchase_date}
                        {p.buyer_name ? ` · kupujący: ${p.buyer_name}` : " · kupujący: —"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {edit ? (
                        <>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label>Kupujący</Label>
                              <Input
                                value={edit.buyer_name}
                                maxLength={100}
                                onChange={(e) =>
                                  setPurchaseRows((r) => ({
                                    ...r,
                                    [p.id]: { ...edit, buyer_name: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="w-24">
                              <Label>Ilość</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.001"
                                min="0"
                                value={edit.purchased_qty}
                                onChange={(e) =>
                                  setPurchaseRows((r) => ({
                                    ...r,
                                    [p.id]: { ...edit, purchased_qty: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="w-24">
                              <Label>Jednostka</Label>
                              <Input
                                value={edit.unit}
                                maxLength={20}
                                onChange={(e) =>
                                  setPurchaseRows((r) => ({
                                    ...r,
                                    [p.id]: { ...edit, unit: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="w-28">
                              <Label>Cena netto</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={edit.total_price_net}
                                onChange={(e) =>
                                  setPurchaseRows((r) => ({
                                    ...r,
                                    [p.id]: { ...edit, total_price_net: e.target.value },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={busyId === `p${p.id}`}
                              onClick={() => savePurchase(p.id)}
                            >
                              Zapisz
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPurchaseRows((r) => {
                                  const next = { ...r };
                                  delete next[p.id];
                                  return next;
                                })
                              }
                            >
                              Anuluj
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm tabular-nums">
                            {p.purchased_qty} {p.unit} · {p.total_price_net} zł netto
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPurchaseRows((r) => ({
                                ...r,
                                [p.id]: {
                                  purchased_qty: p.purchased_qty,
                                  unit: p.unit,
                                  total_price_net: p.total_price_net,
                                  buyer_name: p.buyer_name ?? "",
                                },
                              }))
                            }
                          >
                            Popraw wpis
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // usage
  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Zużycie</CardTitle>
          <CardDescription>
            Ten sam wpis co w raporcie — edycja tu zmienia raport. Brak ceny
            (pozycja bez kosztu) ≠ 0 zł. Pozycje bez zakupu (np. z magazynu)
            są normalne.
          </CardDescription>
        </CardHeader>
      </Card>
      {usage.length === 0 ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Brak pozycji zużycia.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {usage.map((u) => (
            <li key={u.id}>
              <Card className="py-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{u.material_name}</CardTitle>
                  <CardDescription>
                    raport #{u.report_id} · {u.work_date} ·{" "}
                    {u.has_cost ? "z ceną" : "bez ceny"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm tabular-nums">
                    {u.used_qty} {u.unit}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <a href={`/reports/${u.report_id}/edit`}>Edytuj w raporcie</a>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
