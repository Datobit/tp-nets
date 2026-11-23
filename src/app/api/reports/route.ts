import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveReport, type SaveReportInput } from "@/lib/reports";

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
      order_id?: unknown;
      work_date?: unknown;
      employees?: unknown;
      description?: unknown;
      place_details?: unknown;
      department?: unknown;
      notes?: unknown;
      materials?: unknown;
      no_materials?: unknown;
    };

    const employees = Array.isArray(input.employees)
      ? input.employees.map((e) => {
          const emp = e as Record<string, unknown>;
          return {
            employee_id: Number(emp.employee_id),
            start_time: String(emp.start_time ?? ""),
            end_time: String(emp.end_time ?? ""),
          };
        })
      : [];

    const materials = Array.isArray(input.materials)
      ? input.materials.map((m) => {
          const mat = m as Record<string, unknown>;
          return {
            material_id: Number(mat.material_id),
            used_qty: Number(mat.used_qty),
          };
        })
      : [];

    // Autor raportu Z SESJI — nigdy z danych przesłanych przez klienta.
    // Konto techniczne używane było przed wdrożeniem logowania; nowe
    // raporty mają już prawdziwych autorów.
    const result = await saveReport(
      {
        order_id: Number(input.order_id),
        work_date: String(input.work_date ?? ""),
        employees,
        description: typeof input.description === "string" ? input.description : "",
        place_details:
          typeof input.place_details === "string" ? input.place_details : null,
        department:
          typeof input.department === "string" ? input.department : null,
        notes: typeof input.notes === "string" ? input.notes : null,
        materials,
        no_materials: input.no_materials === true,
      },
      session.userId
    );

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/reports:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — raport nie został zapisany." },
      { status: 500 }
    );
  }
}
