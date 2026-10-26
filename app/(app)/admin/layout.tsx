import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <nav className="flex gap-4 border-b pb-3 text-sm">
        <span className="font-medium text-muted-foreground">Admin:</span>
        <Link href="/admin" className="hover:underline">
          Übersicht
        </Link>
        <Link href="/admin/personen" className="hover:underline">
          Personen
        </Link>
        <Link href="/admin/einstellungen" className="hover:underline">
          Einstellungen
        </Link>
      </nav>
      {children}
    </div>
  );
}
