import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateOrder } from "@/lib/orders";

/** PATCH /api/orders/[id]/edit — edycja zlecenia (obiekt, zlecający, tytuł). */
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
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe dane formularza." },
        { status: 400 }
      );
    }

    const raw = body as {
      title?: unknown;
      location_id?: unknown;
      requested_by_contact_id?: unknown;
    };

    const result = await updateOrder(session, orderId, {
      title: typeof raw.title === "string" ? raw.title : "",
      location_id: Number(raw.location_id),
      requested_by_contact_id:
        raw.requested_by_contact_id === null ||
        raw.requested_by_contact_id === undefined ||
        raw.requested_by_contact_id === ""
          ? null
          : Number(raw.requested_by_contact_id),
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH /api/orders/[id]/edit:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — zlecenie nie zostało zapisane." },
      { status: 500 }
    );
  }
}
