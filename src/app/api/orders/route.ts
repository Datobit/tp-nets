import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createOrder } from "@/lib/orders";

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
      new_location?: unknown;
    };

    const newLocationRaw =
      raw.new_location && typeof raw.new_location === "object"
        ? (raw.new_location as { name?: unknown; address?: unknown })
        : null;
    const newLocation =
      newLocationRaw && typeof newLocationRaw.name === "string" && newLocationRaw.name.trim()
        ? {
            name: newLocationRaw.name,
            address:
              typeof newLocationRaw.address === "string"
                ? newLocationRaw.address
                : null,
          }
        : null;

    const result = await createOrder(session, {
      title: typeof raw.title === "string" ? raw.title : "",
      location_id:
        typeof raw.location_id === "number" || typeof raw.location_id === "string"
          ? Number(raw.location_id)
          : null,
      new_location: newLocation,
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
