import Link from "next/link";

export function MainNav({
  active,
}: {
  active: "raporty" | "urlopy" | "zlecenia";
}) {
  const items = [
    { key: "raporty", href: "/", label: "Raporty" },
    { key: "urlopy", href: "/leaves", label: "Urlopy" },
    { key: "zlecenia", href: "/orders", label: "Zlecenia" },
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
