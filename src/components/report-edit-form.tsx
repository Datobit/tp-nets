"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface EditEmployeeRow {
  employee_id: number;
  start_time: string;
  end_time: string;
}

export interface EditMaterialRow {
  material_id: number;
  used_qty: string;
  unit: string;
}

export interface EditableReport {
  id: number;
  order_id: number;
  work_date: string;
  place_details: string | null;
  department: string | null;
  description: string;
  notes: string | null;
  no_materials: boolean;
  employees: { employee_id: number; name: string; start_time: string; end_time: string }[];
  materials: { id?: number; material_id: number | null; name: string; used_qty: string; unit: string }[];
}

export interface EmployeeOption {
  id: number;
  first_name: string;
  last_name: string;
}

export interface MaterialOption {
  id: number;
  name: string;
  base_unit: string;
}

function displayName(e: { first_name: string; last_name: string }) {
  return e.last_name === "Demo" ? e.first_name : e.first_name;
}

/**
 * Edycja WŁASNEGO raportu: miejsce pracy, uwagi, godziny, materiały.
 * Zlecenie raportu jest stałe. Material bez material_id (własny wpis) —
 * tylko odczyt; nie da się go przemapować na katalog (bez zgadywania).
 */
export default function ReportEditForm({
  report,
  employees,
  materials,
}: {
  report: EditableReport;
  employees: EmployeeOption[];
  materials: MaterialOption[];
}) {
  const router = useRouter();
  const [workDate, setWorkDate] = useState(report.work_date);
  const [placeDetails, setPlaceDetails] = useState(report.place_details ?? "");
  const [department, setDepartment] = useState(report.department ?? "");
  const [description, setDescription] = useState(report.description);
  const [notes, setNotes] = useState(report.notes ?? "");
  const [noMaterials, setNoMaterials] = useState(report.no_materials);
  const [rows, setRows] = useState<EditMaterialRow[]>(
    report.materials
      .filter((m) => m.material_id !== null)
      .map((m) => ({
        material_id: m.material_id as number,
        used_qty: m.used_qty,
        unit: m.unit,
      }))
  );
  const [empRows, setEmpRows] = useState<EditEmployeeRow[]>(
    report.employees.map((e) => ({
      employee_id: e.employee_id,
      start_time: e.start_time,
      end_time: e.end_time,
    }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateEmpRow(index: number, patch: Partial<EditEmployeeRow>) {
    setEmpRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function updateRow(index: number, patch: Partial<EditMaterialRow>) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    setError(null);

    const selectedWorkers = empRows.filter((r) => r.employee_id > 0);
    if (selectedWorkers.length === 0) {
      setError("Wybierz co najmniej jednego montera.");
      return;
    }
    for (const r of selectedWorkers) {
      if (!/^\d{2}:\d{2}$/.test(r.start_time) || !/^\d{2}:\d{2}$/.test(r.end_time)) {
        setError("Godziny mają format HH:MM.");
        return;
      }
      if (r.end_time <= r.start_time) {
        setError("Godzina zakończenia musi być po rozpoczęciu.");
        return;
      }
    }
    if (noMaterials && rows.length > 0) {
      setError("Nie można łączyć „brak materiałów” z pozycjami.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_date: workDate,
          employees: selectedWorkers,
          description,
          place_details: placeDetails || null,
          department: department || null,
          notes: notes || null,
          materials: noMaterials
            ? []
            : rows
                .filter((r) => r.material_id > 0 && r.used_qty !== "")
                .map((r) => ({
                  material_id: r.material_id,
                  used_qty: Number(r.used_qty.replace(",", ".")),
                  unit: r.unit,
                })),
          no_materials: noMaterials,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Nie udało się zapisać zmian raportu.");
        return;
      }
      router.push(`/reports/${report.id}`);
      router.refresh();
    } catch {
      setError("Błąd połączenia — zmiany nie zostały zapisane.");
    } finally {
      setSaving(false);
    }
  }

  const catalogOptions = [...materials];

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
          <CardTitle>Raport #{report.id} — edycja</CardTitle>
          <CardDescription>
            Zlecenie raportu jest stałe; poprawiasz treść roboczą.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="work-date">Data pracy</Label>
            <Input
              id="work-date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="place-details">Miejsce prac</Label>
            <Input
              id="place-details"
              value={placeDetails}
              onChange={(e) => setPlaceDetails(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Dział</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Opis wykonanych czynności</Label>
            <textarea
              id="description"
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50"
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
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monterzy i godziny</CardTitle>
          <CardDescription>Format HH:MM; koniec po rozpoczęciu.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {empRows.map((row, index) => (
            <div key={index} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex-1">
                <Select
                  value={String(row.employee_id)}
                  onValueChange={(v) => updateEmpRow(index, { employee_id: Number(v) })}
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
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label>Od</Label>
                  <Input
                    type="time"
                    value={row.start_time}
                    onChange={(e) => updateEmpRow(index, { start_time: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <Label>Do</Label>
                  <Input
                    type="time"
                    value={row.end_time}
                    onChange={(e) => updateEmpRow(index, { end_time: e.target.value })}
                  />
                </div>
                {empRows.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-5"
                    onClick={() => setEmpRows((rs) => rs.filter((_, i) => i !== index))}
                  >
                    Usuń
                  </Button>
                )}
              </div>
            </div>
          ))}
          {empRows.length < 3 && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setEmpRows((rs) => [...rs, { employee_id: 0, start_time: "08:00", end_time: "16:00" }])
              }
            >
              Dodaj montera
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zużyte materiały</CardTitle>
          <CardDescription>
            Jednostka katalogowa to podpowiedź — możesz wpisać inną (np. 0,5
            paczki albo 20 szt.). Pozycje nie są sumowane między jednostkami.
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
              {rows.map((row, index) => {
                const mat = catalogOptions.find((m) => m.id === row.material_id);
                return (
                  <div key={index} className="flex flex-col gap-2 rounded-md border p-3">
                    <div className="flex-1">
                      <Label>Materiał {index + 1}</Label>
                      <Select
                        value={String(row.material_id)}
                        onValueChange={(v) =>
                          updateRow(index, {
                            material_id: Number(v),
                            // jednostka = podpowiedź katalogowa nowo wybranego materiału
                            unit: catalogOptions.find((m) => m.id === Number(v))?.base_unit ?? "",
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Wybierz materiał" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogOptions.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label>Ilość</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.001"
                          min="0"
                          value={row.used_qty}
                          onChange={(e) => updateRow(index, { used_qty: e.target.value })}
                        />
                      </div>
                      <div className="w-24">
                        <Label>Jednostka</Label>
                        <Input
                          value={row.unit}
                          placeholder={mat?.base_unit ?? ""}
                          onChange={(e) => updateRow(index, { unit: e.target.value })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-5"
                        onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))}
                      >
                        Usuń
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const first = catalogOptions[0];
                  if (!first) return;
                  setRows((rs) => [
                    ...rs,
                    { material_id: first.id, used_qty: "", unit: first.base_unit },
                  ]);
                }}
              >
                Dodaj pozycję
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex gap-3">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Zapisywanie…" : "Zapisz zmiany"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={`/reports/${report.id}`}>Anuluj</a>
        </Button>
      </div>
    </form>
  );
}
