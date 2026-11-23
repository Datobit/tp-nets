import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { restoreReport } from "@/lib/reports";

/**
 * POST /api/reports/[id]/restore — przywrócenie usuniętego raportu.
 * Tylko szef (rola sprawdzana po stronie serwera).
 */
export async function POST(
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

    const result = await restoreReport(reportId, {
      role: session.role,
      userId: session.userId,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/reports/[id]/restore:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — raport nie został przywrócony." },
      { status: 500 }
    );
  }
}
