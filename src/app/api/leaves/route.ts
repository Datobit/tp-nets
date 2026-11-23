import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createLeaveRequestForSession } from "@/lib/leaves";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Wymagane zalogowanie." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe dane formularza." },
        { status: 400 }
      );
    }

    const input = body as {
      employee_id?: unknown;
      start_date?: unknown;
      end_date?: unknown;
      note?: unknown;
    };

    const result = await createLeaveRequestForSession(session, {
      employee_id: Number(input.employee_id),
      start_date: String(input.start_date ?? ""),
      end_date: String(input.end_date ?? ""),
      note: typeof input.note === "string" ? input.note : null,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/leaves:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — wniosek nie został zapisany." },
      { status: 500 }
    );
  }
}
