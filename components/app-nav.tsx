import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { Avatar } from "@/components/termin-bits";
import { getCurrentUser } from "@/lib/dal/auth";

export async function AppNav({ variant }: { variant: "header" | "tabbar" }) {
  const user = await getCurrentUser();
  if (!user) return null;
  return <NavLinks variant={variant} isAdmin={user.isAdmin} />;
}

/** Avatar (and on desktop the name) linking to the profile. */
export async function UserLink() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <Link
      href="/profil"
      aria-label={`Profil von ${user.fullName}`}
      className="flex h-11 items-center gap-2.5 rounded-full text-sm font-medium md:rounded-xl md:pr-3 md:pl-1.5 md:hover:bg-muted"
    >
      <Avatar
        name={user.fullName}
        className="size-10 bg-card ring-1 ring-border md:size-8 md:bg-zinc-200 md:ring-0"
      />
      <span className="hidden md:inline">{user.fullName}</span>
    </Link>
  );
}
