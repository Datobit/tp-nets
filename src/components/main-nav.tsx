import Link from "next/link";

export type NavKey = "raporty" | "wszystkie" | "urlopy" | "zlecenia" | "materialy" | "obiekty";

export function MainNav({ active }: { active: NavKey }) {
  const items = [
    { key: "raporty", href: "/", label: "Raporty" },
    { key: "zlecenia", href: "/orders", label: "Zlecenia" },
    { key: "obiekty", href: "/locations", label: "Obiekty" },
    { key: "materialy", href: "/materials", label: "Materiały" },
    { key: "urlopy", href: "/leaves", label: "Urlopy" },
  ] as const;

  return (
    <nav className="flex gap-1 border-b pb-2">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            active === item.key
              ? "bg-muted text-foreground"
              : "text-muted-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Link „Wszystkie raporty” — tylko szef (widoczność decyduje strona serwerowa). */
export function BossAllReportsLink() {
  return (
    <Link
      href="/reports/all"
      className="text-sm text-muted-foreground underline"
    >
      Wszystkie raporty
    </Link>
  );
}
