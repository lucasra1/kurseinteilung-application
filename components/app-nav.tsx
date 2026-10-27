import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { Avatar } from "@/components/termin-bits";
import { getCurrentUser } from "@/lib/dal/auth";
import { cn } from "@/lib/utils";

export async function AppNav({ variant }: { variant: "header" | "tabbar" }) {
  const user = await getCurrentUser();
  if (!user) return null;
  return <NavLinks variant={variant} isAdmin={user.isAdmin} />;
}

// Full class names, so Tailwind finds them. Admins see the name only from `lg` on: at `md`
// it doesn't fit next to their five tabs.
const USER_LINK = {
  md: {
    link: "md:rounded-xl md:pr-3 md:pl-1.5 md:hover:bg-muted",
    avatar: "md:size-8 md:bg-zinc-200 md:ring-0",
    name: "md:inline",
  },
  lg: {
    link: "lg:rounded-xl lg:pr-3 lg:pl-1.5 lg:hover:bg-muted",
    avatar: "lg:size-8 lg:bg-zinc-200 lg:ring-0",
    name: "lg:inline",
  },
};

/** Avatar (and on desktop the name) linking to the profile. */
export async function UserLink() {
  const user = await getCurrentUser();
  if (!user) return null;
  const wide = USER_LINK[user.isAdmin ? "lg" : "md"];
  return (
    <Link
      href="/profil"
      aria-label={`Profil von ${user.fullName}`}
      className={cn(
        "flex h-11 items-center gap-2.5 rounded-full text-sm font-medium",
        wide.link,
      )}
    >
      <Avatar
        name={user.fullName}
        className={cn("size-10 bg-card ring-1 ring-border", wide.avatar)}
      />
      <span className={cn("hidden", wide.name)}>{user.fullName}</span>
    </Link>
  );
}
