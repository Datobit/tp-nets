import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteReport } from "@/lib/reports";

/**
 * DELETE /api/reports/[id] — TRWAŁE usunięcie własnego raportu (tylko autor):
 * raport + pozycje zużycia + przypisania monterów w jednej transakcji.
 * Zlecenie, katalog i zakupy nietknięte. Stary link zwraca potem 404.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const reportId = Number(id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy raport." },
        { status: 400 }
      );
    }

    const result = await deleteReport(reportId, {
      role: session.role,
      userId: session.userId,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("DELETE /api/reports/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — raport nie został usunięty." },
      { status: 500 }
    );
  }
}
