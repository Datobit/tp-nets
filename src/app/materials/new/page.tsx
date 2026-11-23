import { Suspense } from "react";
import { MainNav } from "@/components/main-nav";
import MaterialForm from "@/components/material-form";

async function MaterialFormInner({
  searchParams,
}: {
  searchParams: Promise<{ inline?: string }>;
}) {
  const { inline } = await searchParams;
  return <MaterialForm inline={inline === "1"} />;
}

export default function NewMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ inline?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
      <MainNav active="raporty" />
      <h2 className="text-lg font-medium">Dodaj materiał</h2>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Ładowanie…</p>}
      >
        <MaterialFormInner searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
