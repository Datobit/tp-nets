import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { closeOrder, deleteOrder } from "@/lib/orders";

/**
 * PATCH /api/orders/[id] — akcje na zleceniu. Zostaje „close” (tylko szef);
 * edycja treści idzie przez PATCH /api/orders/[id]/edit.
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
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe zlecenie." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const action =
      body && typeof (body as { action?: unknown }).action === "string"
        ? (body as { action: string }).action
        : "";

    const result =
      action === "close"
        ? await closeOrder(session, orderId)
        : action === "delete"
          ? await deleteOrder(session, orderId)
          : null;

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowa operacja." },
        { status: 400 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH /api/orders/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — operacja nie została zapisana." },
      { status: 500 }
    );
  }
}
