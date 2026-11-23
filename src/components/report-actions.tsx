"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Usunięcie raportu z potwierdzeniem (soft-delete; szef może przywrócić). */
export function DeleteReportButton({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Nie udało się usunąć raportu.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-destructive"
        onClick={() => setConfirming(true)}
      >
        Usuń raport
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Usunąć raport? Znika z widoków; szef będzie mógł go przywrócić.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={doDelete}
        >
          {busy ? "Usuwanie…" : "Tak, usuń"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          Anuluj
        </Button>
      </div>
    </div>
  );
}

/** Przywrócenie usuniętego raportu — tylko szef widzi przycisk. */
export function RestoreReportButton({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doRestore() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/restore`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Nie udało się przywrócić raportu.");
        return;
      }
      router.refresh();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={doRestore}>
        {busy ? "Przywracanie…" : "Przywróć raport"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
