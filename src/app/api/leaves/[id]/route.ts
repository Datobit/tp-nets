import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateLeaveRequestForSession } from "@/lib/leaves";

/**
 * PATCH /api/leaves/[id] — edycja WŁASNEGO oczekującego wniosku (pracownik;
 * szef może poprawić dowolny). Zatwierdzony/odrzucony wniosek nie podlega
 * edycji — reguła sprawdzana w transakcji zapisu (stan w chwili PATCH-a).
 */
export async function PATCH(
  req: Request,
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
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe dane formularza." },
        { status: 400 }
      );
    }

    const input = body as {
      dates?: unknown;
      start_date?: unknown;
      end_date?: unknown;
      note?: unknown;
    };

    const result = await updateLeaveRequestForSession(session, {
      id: Number(id),
      dates: input.dates,
      start_date: typeof input.start_date === "string" ? input.start_date : undefined,
      end_date: typeof input.end_date === "string" ? input.end_date : undefined,
      note: typeof input.note === "string" ? input.note : null,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH /api/leaves/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — wniosek nie został zapisany." },
      { status: 500 }
    );
  }
}
