import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createOrder } from "@/lib/orders";

/**
 * POST /api/orders — nowe zlecenie. Wymagane: tytuł, obiekt, osoba
 * zlecająca (kontakt wybranego obiektu). Numer nadaje serwer.
 */
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

    const raw = body as {
      title?: unknown;
      location_id?: unknown;
      requested_by_contact_id?: unknown;
    };

    const result = await createOrder(session, {
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
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/orders:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — zlecenie nie zostało dodane." },
      { status: 500 }
    );
  }
}
