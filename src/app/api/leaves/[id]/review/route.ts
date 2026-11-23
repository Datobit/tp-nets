import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reviewLeaveRequestForSession } from "@/lib/leaves";

export async function POST(
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
    const decision =
      body && (body as { decision?: unknown }).decision === "approve"
        ? "approve"
        : body && (body as { decision?: unknown }).decision === "reject"
          ? "reject"
          : null;

    if (!decision) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowa decyzja." },
        { status: 400 }
      );
    }

    const result = await reviewLeaveRequestForSession(session, {
      id: Number(id),
      decision,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/leaves/[id]/review:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — decyzja nie została zapisana." },
      { status: 500 }
    );
  }
}
