import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { Avatar } from "@/components/termin-bits";
import { getCurrentUser } from "@/lib/dal/auth";

export async function AppNav({ variant }: { variant: "header" | "tabbar" }) {
  const user = await getCurrentUser();
  if (!user) return null;
  return <NavLinks variant={variant} isAdmin={user.isAdmin} />;
}

/** Avatar (and on wide screens the name) linking to the profile. */
export async function UserLink() {
  const user = await getCurrentUser();
  if (!user) return null;
  // From `lg` on: at `md`, the name doesn't fit next to the admins' five tabs.
  return (
    <Link
      href="/profil"
      aria-label={`Profil von ${user.fullName}`}
      className="flex h-11 items-center gap-2.5 rounded-full text-sm font-medium lg:rounded-xl lg:pr-3 lg:pl-1.5 lg:hover:bg-muted"
    >
      <Avatar
        name={user.fullName}
        className="size-10 bg-card ring-1 ring-border lg:size-8 lg:bg-zinc-200 lg:ring-0"
      />
      <span className="hidden lg:inline">{user.fullName}</span>
    </Link>
  );
}
