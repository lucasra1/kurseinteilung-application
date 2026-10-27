"use client";

import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CircleUser,
  History,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/termine", label: "Termine", icon: CalendarDays },
  { href: "/meine", label: "Meine", icon: CalendarCheck },
  { href: "/kurse", label: "Kurse", icon: BookOpen, adminOnly: true },
  { href: "/personen", label: "Personen", icon: Users, adminOnly: true },
  { href: "/verlauf", label: "Verlauf", icon: History, adminOnly: true },
  // On desktop the name in the header leads to the profile.
  { href: "/profil", label: "Profil", icon: CircleUser, mobileOnly: true },
];

/** Main navigation: tabs in the header from `md` on, a tab bar at the bottom below. */
export function NavLinks({
  variant,
  isAdmin,
}: {
  variant: "header" | "tabbar";
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const items = ITEMS.filter(
    (item) =>
      (isAdmin || !item.adminOnly) &&
      (variant === "tabbar" || !item.mobileOnly),
  );
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "header") {
    return (
      <nav aria-label="Hauptnavigation" className="hidden gap-1 md:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive(item.href) && "bg-muted font-semibold text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div
        className="grid px-1 pt-1.5 pb-1"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-13 min-w-0 flex-col items-center justify-center gap-1 font-medium text-muted-foreground",
                // Six tabs for admins: "Personen" must fit a sixth of 360 px.
                items.length > 5 ? "text-[11px]" : "text-xs",
                active && "font-semibold text-primary",
              )}
            >
              <item.icon aria-hidden="true" className="size-[22px]" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
