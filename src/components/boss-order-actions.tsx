"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Akcje szefa na zleceniu: zmiana nazwy i zamknięcie. */
export function BossOrderActions({
  orderId,
  currentTitle,
}: {
  orderId: number;
  currentTitle: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function send(
    action: "rename" | "close" | "delete",
    payload?: { title: string }
  ) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Operacja nie powiodła się.");
        return;
      }
      if (action === "delete") {
        router.push("/orders");
        router.refresh();
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"
        >
          {error}
        </div>
      )}
      {confirmingDelete ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            Trwale usunąć zlecenie razem z jego raportami? Operacji nie można
            cofnąć.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => send("delete")}
            >
              {busy ? "Usuwanie…" : "Tak, usuń trwale"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmingDelete(false)}
            >
              Anuluj
            </Button>
          </div>
        </div>
      ) : editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            aria-label="Nowa nazwa zlecenia"
          />
          <Button
            size="sm"
            disabled={busy || !title.trim()}
            onClick={() => send("rename", { title })}
          >
            Zapisz
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setTitle(currentTitle);
            }}
          >
            Anuluj
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Zmień nazwę
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => send("close")}
          >
            Zamknij zlecenie
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
          >
            Usuń zlecenie
          </Button>
        </div>
      )}
    </div>
  );
}
