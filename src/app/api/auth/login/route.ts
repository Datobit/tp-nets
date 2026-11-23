import { NextResponse } from "next/server";
import { createSession, verifyCredentials } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const login =
      body && typeof (body as { login?: unknown }).login === "string"
        ? (body as { login: string }).login
        : "";
    const password =
      body && typeof (body as { password?: unknown }).password === "string"
        ? (body as { password: string }).password
        : "";

    const user = await verifyCredentials(login, password);
    if (!user) {
      // celowo ogólny komunikat — nie ujawniamy, czy konto istnieje
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy login lub hasło." },
        { status: 401 }
      );
    }
    await createSession(user);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/login:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — logowanie nieudane." },
      { status: 500 }
    );
  }
}
