"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export interface OrderOption {
  id: number;
  title: string;
  department: string | null;
  place: string | null;
  location_name: string;
  location_address: string;
}

export interface EmployeeOption {
  id: number;
  first_name: string;
  last_name: string;
}

/**
 * Wyświetlana nazwa pracownika. Osoby z technicznym nazwiskiem „Demo”
 * (dane tymczasowe) pokazywane są samo imieniem; nazwiska poprawi migracja.
 */
function displayName(e: {
  first_name: string;
  last_name: string;
}) {
  return e.last_name === "Demo" ? e.first_name : `${e.last_name} ${e.first_name}`;
}

export interface MaterialOption {
  id: number;
  name: string;
  base_unit: string;
}

interface MaterialRow {
  key: number;
  material_id: string;
  used_qty: string;
  unit: string;
}

const MAX_EMPLOYEES = 3;

const STATE_KEY = "tp_nets_report_draft";

function todayWarsaw(): string {
  // Dzisiaj według Europe/Warsaw, bez zależności od strefy serwera.
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
  });
  return fmt.format(new Date());
}

export default function ReportForm({
  orders,
  employees,
  materials,
}: {
  orders: OrderOption[];
  employees: EmployeeOption[];
  materials: MaterialOption[];
}) {
  const router = useRouter();

  const [orderId, setOrderId] = useState<string>("");
  const [workDate, setWorkDate] = useState<string>(todayWarsaw());
  const [workerIds, setWorkerIds] = useState<string[]>([
    employees[0] ? String(employees[0].id) : "",
  ]);
  const [description, setDescription] = useState<string>("");
  const [placeDetails, setPlaceDetails] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [noMaterials, setNoMaterials] = useState<boolean>(false);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const selectedOrder = orders.find((o) => String(o.id) === orderId);

  // Katalog: materiały z serwera + nowe dodane w tej sesji (lokalnie,
  // aż do odświeżenia z bazy).
  const [localMaterials, setLocalMaterials] = useState<MaterialOption[]>([]);
  const allMaterials = [
    ...materials,
    ...localMaterials.filter(
      (lm) => !materials.some((m) => m.id === lm.id)
    ),
  ];

  // Działy z istniejących danych (zlecenia) — bez wymyślania listy.
  const departmentOptions = Array.from(
    new Set(orders.map((o) => o.department).filter((d): d is string => Boolean(d)))
  );

  // Pełny stan formularza — zapis przed „Dodaj zlecenie”, przywrócenie po powrocie.
  function currentState() {
    return {
      orderId,
      workDate,
      workerIds,
      description,
      placeDetails,
      department,
      notes,
      noMaterials,
      materialRows,
    };
  }

  function restoreState(saved: ReturnType<typeof currentState>) {
    setOrderId(saved.orderId ?? "");
    setWorkDate(saved.workDate || todayWarsaw());
    setWorkerIds(saved.workerIds?.length ? saved.workerIds : [employees[0] ? String(employees[0].id) : ""]);
    setDescription(saved.description ?? "");
    setPlaceDetails(saved.placeDetails ?? "");
    setDepartment(saved.department ?? "");
    setNotes(saved.notes ?? "");
    setNoMaterials(saved.noMaterials ?? false);
    setMaterialRows(saved.materialRows ?? []);
  }

  // Powrót z „Dodaj zlecenie” lub „Dodaj materiał”: przywróć szkic
  // i wybierz nowo dodany element.
  useEffect(() => {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(STATE_KEY);
    try {
      restoreState(JSON.parse(raw));
      const newOrderId = sessionStorage.getItem("tp_nets_new_order");
      if (newOrderId) {
        sessionStorage.removeItem("tp_nets_new_order");
        setOrderId(newOrderId);
      }
      const newMaterialRaw = sessionStorage.getItem("tp_nets_new_material");
      if (newMaterialRaw) {
        sessionStorage.removeItem("tp_nets_new_material");
        const mat = JSON.parse(newMaterialRaw) as {
          id: number;
          name: string;
          base_unit: string;
        };
        // dołącz materiał do lokalnej listy opcji i do wierszy zużycia
        setLocalMaterials((prev) =>
          prev.some((m) => m.id === mat.id) ? prev : [...prev, mat]
        );
        setMaterialRows((rows) => {
          if (rows.some((r) => r.material_id === String(mat.id))) return rows;
          return [
            ...rows,
            {
              key: Date.now(),
              material_id: String(mat.id),
              used_qty: "",
              unit: mat.base_unit,
            },
          ];
        });
      }
    } catch {
      // uszkodzony szkic — ignoruj, formularz zostaje pusty
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addWorker() {
    if (workerIds.length >= MAX_EMPLOYEES) return;
    const next =
      employees.find((e) => !workerIds.includes(String(e.id))) ?? null;
    setWorkerIds([...workerIds, String(next?.id ?? "")]);
  }

  function removeWorker(index: number) {
    setWorkerIds(workerIds.filter((_, i) => i !== index));
  }

  function setWorker(index: number, value: string) {
    setWorkerIds(workerIds.map((id, i) => (i === index ? value : id)));
  }

  function addMaterialRow() {
    if (noMaterials) return;
    setMaterialRows((rows) => [
      ...rows,
      {
        key: Date.now() + rows.length,
        material_id: allMaterials[0] ? String(allMaterials[0].id) : "",
        used_qty: "",
        unit: allMaterials[0]?.base_unit ?? "",
      },
    ]);
  }

  function removeMaterialRow(key: number) {
    setMaterialRows((rows) => rows.filter((r) => r.key !== key));
  }

  function updateMaterialRow(key: number, patch: Partial<MaterialRow>) {
    setMaterialRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return; // blokada ponownego kliknięcia
    setError(null);

    const selectedWorkers = workerIds.filter((id) => id !== "");
    if (selectedWorkers.length === 0) {
      setError("Wybierz co najmniej jednego montera.");
      return;
    }
    if (new Set(selectedWorkers).size !== selectedWorkers.length) {
      setError("Monterzy muszą być różni (bez duplikatów).");
      return;
    }
    if (noMaterials && materialRows.length > 0) {
      setError(
        "Nie można jednocześnie zaznaczyć „brak materiałów” i podać pozycje."
      );
      return;
    }

    const payload = {
      order_id: Number(orderId),
      work_date: workDate,
      employees: selectedWorkers.map((id) => ({
        employee_id: Number(id),
        start_time: "08:00",
        end_time: "16:00",
      })),
      description,
      place_details: placeDetails || null,
      department: department || null,
      notes: notes || null,
      materials: noMaterials
        ? []
        : materialRows
            .filter((r) => r.material_id !== "" && r.used_qty !== "")
            .map((r) => ({
              material_id: Number(r.material_id),
              used_qty: Number(r.used_qty.replace(",", ".")),
              unit: r.unit,
            })),
      no_materials: noMaterials,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(
          data?.error ?? "Nie udało się zapisać raportu. Spróbuj ponownie."
        );
        return;
      }
      router.push(`/reports/${data.id}`);
    } catch {
      setError("Błąd połączenia — raport nie został zapisany.");
    } finally {
      setSaving(false);
    }
  }

  const anyMaterialRowFilled =
    materialRows.length > 0 &&
    materialRows.every((r) => r.material_id !== "" && r.used_qty !== "");

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
          <CardTitle>Nagłówek raportu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order">Zlecenie</Label>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger id="order" className="w-full">
                    <SelectValue placeholder="Wybierz zlecenie" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  // zapamiętaj stan formularza; powrót przywróci i wybierze nowe zlecenie
                  sessionStorage.setItem(STATE_KEY, JSON.stringify(currentState()));
                  router.push("/orders/new?inline=1");
                }}
              >
                Dodaj zlecenie
              </Button>
            </div>
            {selectedOrder && (
              <div className="mt-1 rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{selectedOrder.location_name}</p>
                <p className="text-muted-foreground">
                  {selectedOrder.location_address}
                </p>
                {selectedOrder.department && (
                  <p>Dział (z zlecenia, do podglądu): {selectedOrder.department}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Dział (raport)</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger id="department" className="w-full">
                <SelectValue placeholder="Wybierz dział (opcjonalnie)" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Dział dla tego raportu — zlecenie go nie narzuca.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="work-date">Data pracy</Label>
            <Input
              id="work-date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="place-details">Miejsce prac</Label>
            <Input
              id="place-details"
              placeholder="np. Wyjście nr 20, hala B — słup 12"
              value={placeDetails}
              onChange={(e) => setPlaceDetails(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Faktyczne miejsce robót tego raportu — zapisywane bez prefiksu
              ze zlecenia.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monterzy (ekipa)</CardTitle>
          <CardDescription>
            Od 1 do {MAX_EMPLOYEES} różnych osób. Godziny: 08:00–16:00
            (edytowalne w wersji docelowej).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {workerIds.map((id, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={id}
                  onValueChange={(v) => setWorker(index, v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Wybierz montera" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {displayName(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">
                08:00–16:00
              </span>
              {workerIds.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeWorker(index)}
                  aria-label="Usuń montera"
                >
                  Usuń
                </Button>
              )}
            </div>
          ))}
          {workerIds.length < MAX_EMPLOYEES && (
            <Button type="button" variant="outline" onClick={addWorker}>
              Dodaj montera
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wykonana praca</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Opis wykonanych czynności</Label>
            <textarea
              id="description"
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50"
              placeholder="np. montaż dwóch ładowarek, pomiary, uruchomienie"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Uwagi (opcjonalnie)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="np. potrzebny drugi serwisant w środę"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zużyte materiały</CardTitle>
          <CardDescription>
            Materiały z katalogu; ilość w jednostce materiału.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={noMaterials}
              onChange={(e) => setNoMaterials(e.target.checked)}
            />
            Raport bez materiałów
          </label>

          {!noMaterials && (
            <>
              {materialRows.map((row, i) => {
                const mat = allMaterials.find(
                  (m) => String(m.id) === row.material_id
                );
                return (
                  <div
                    key={row.key}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`mat-${row.key}`}>Materiał {i + 1}</Label>
                        <Select
                          value={row.material_id}
                          onValueChange={(v) =>
                            updateMaterialRow(row.key, { material_id: v })
                          }
                        >
                          <SelectTrigger id={`mat-${row.key}`} className="w-full">
                            <SelectValue placeholder="Wybierz materiał" />
                          </SelectTrigger>
                          <SelectContent>
                            {allMaterials.map((m) => (
                              <SelectItem key={m.id} value={String(m.id)}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-5"
                        onClick={() => removeMaterialRow(row.key)}
                        aria-label={`Usuń materiał ${i + 1}`}
                      >
                        Usuń
                      </Button>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`qty-${row.key}`}>Ilość</Label>
                        <Input
                          id={`qty-${row.key}`}
                          type="number"
                          inputMode="decimal"
                          step="0.001"
                          min="0"
                          placeholder="np. 75"
                          value={row.used_qty}
                          onChange={(e) =>
                            updateMaterialRow(row.key, {
                              used_qty: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="w-24">
                        <Label>Jednostka</Label>
                        <Input
                          value={row.unit ?? ""}
                          placeholder={mat?.base_unit ?? ""}
                          maxLength={20}
                          onChange={(e) =>
                            updateMaterialRow(row.key, { unit: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={addMaterialRow}
                >
                  Dodaj pozycję
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    sessionStorage.setItem(STATE_KEY, JSON.stringify(currentState()));
                    router.push("/materials/new?inline=1");
                  }}
                >
                  Dodaj materiał
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex gap-3">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Zapisywanie…" : "Zapisz raport"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/">Anuluj</Link>
        </Button>
      </div>
      {saving && anyMaterialRowFilled && (
        <p className="text-xs text-muted-foreground">
          Trwa zapisywanie raportu…
        </p>
      )}
    </form>
  );
}
