import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { MainNav } from "@/components/main-nav";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import MaterialViews from "@/components/material-views";

export interface MaterialRow {
  id: number;
  name: string;
  base_unit: string;
  is_active: boolean;
  purchases_count: number;
  usage_count: number;
}

export interface PurchaseRow {
  id: number;
  material_id: number;
  material_name: string;
  purchase_date: string;
  purchased_qty: string;
  unit: string;
  total_price_net: string;
  buyer_name: string | null;
}

export interface UsageRow {
  id: number;
  report_id: number;
  work_date: string;
  material_name: string;
  used_qty: string;
  unit: string;
  has_cost: boolean;
}

async function MaterialsInner({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await connection();
  await requireSession();
  const { view } = await searchParams;
  const activeView = view === "purchases" || view === "usage" ? view : "catalog";

  const [materials, purchases, usage] = await Promise.all([
    query<MaterialRow>(
      `SELECT m.id, m.name, m.base_unit, m.is_active,
              (SELECT count(*) FROM material_purchases p WHERE p.material_id = m.id) AS purchases_count,
              (SELECT count(*) FROM report_materials r WHERE r.material_id = m.id) AS usage_count
       FROM materials m
       ORDER BY m.is_active DESC, m.name`
    ),
    query<PurchaseRow>(
      `SELECT p.id, p.material_id, m.name AS material_name,
              to_char(p.purchase_date, 'YYYY-MM-DD') AS purchase_date,
              to_char(p.purchased_qty, 'FM999999990.000') AS purchased_qty,
              p.unit,
              to_char(p.total_price_net, 'FM999999990.00') AS total_price_net,
              x.buyer_name
       FROM material_purchases p
       JOIN materials m ON m.id = p.material_id
       LEFT JOIN material_purchases_ext_info x ON x.purchase_id = p.id
       ORDER BY p.purchase_date DESC, p.id DESC
       LIMIT 200`
    ),
    query<UsageRow>(
      `SELECT rm.id,
              rm.work_report_id AS report_id,
              to_char(r.work_date, 'YYYY-MM-DD') AS work_date,
              COALESCE(m.name, rm.custom_name) AS material_name,
              to_char(rm.used_qty, 'FM999999990.000') AS used_qty,
              rm.unit,
              (rm.suggested_cost_net IS NOT NULL) AS has_cost
       FROM report_materials rm
       JOIN work_reports r ON r.id = rm.work_report_id
       LEFT JOIN materials m ON m.id = rm.material_id
       WHERE r.deleted_at IS NULL
       ORDER BY r.work_date DESC, rm.id DESC
       LIMIT 200`
    ),
  ]);

  return (
    <MaterialViews
      view={activeView}
      materials={materials.rows}
      purchases={purchases.rows}
      usage={usage.rows}
    />
  );
}

export default function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Materiały</h1>
        <LogoutButton />
      </div>
      <MainNav active="materialy" />
      <div className="flex gap-2">
        {(
          [
            ["catalog", "Katalog"],
            ["purchases", "Zakupy"],
            ["usage", "Zużycie"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            asChild
            size="sm"
            variant={label === "Katalog" ? undefined : "outline"}
          >
            <Link href={`/materials?view=${key}`}>{label}</Link>
          </Button>
        ))}
      </div>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <MaterialsInner searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
