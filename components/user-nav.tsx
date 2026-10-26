import Link from "next/link";
import { logout } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal/auth";

export async function UserNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-4 text-sm">
      {user.isAdmin && (
        <Link href="/admin" className="font-medium hover:underline">
          Admin
        </Link>
      )}
      <span className="text-muted-foreground">{user.fullName}</span>
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm">
          Abmelden
        </Button>
      </form>
    </div>
  );
}
