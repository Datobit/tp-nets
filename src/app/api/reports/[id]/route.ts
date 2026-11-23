import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateReport, deleteReport } from "@/lib/reports";

/**
 * PATCH /api/reports/[id] — edycja własnego raportu (tylko autor).
 * DELETE /api/reports/[id] — usunięcie własnego raportu (tylko autor).
 * Monter dopisany do raportu NIE ma tu dostępu (reguła po stronie serwera).
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
    const reportId = Number(id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy raport." },
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

    const input = body as {
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
            unit: typeof mat.unit === "string" ? mat.unit : null,
          };
        })
      : [];

    const result = await updateReport(
      reportId,
      { role: session.role, userId: session.userId },
      {
        work_date: String(input.work_date ?? ""),
        employees,
        description:
          typeof input.description === "string" ? input.description : "",
        place_details:
          typeof input.place_details === "string" ? input.place_details : null,
        department:
          typeof input.department === "string" ? input.department : null,
        notes: typeof input.notes === "string" ? input.notes : null,
        materials,
        no_materials: input.no_materials === true,
      }
    );

    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH /api/reports/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — zmiany raportu nie zostały zapisane." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const result = await deleteReport(reportId, {
      role: session.role,
      userId: session.userId,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("DELETE /api/reports/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "Błąd serwera — raport nie został usunięty." },
      { status: 500 }
    );
  }
}
