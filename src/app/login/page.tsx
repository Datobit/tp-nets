import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

async function LoginPageContent() {
  // Pełna weryfikacja sesji (podpis + wygaszenie) po stronie serwera;
  // zalogowanych przenosi na stronę główną.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">TP-NETS</h1>
      <LoginForm />
    </main>
  );
}
