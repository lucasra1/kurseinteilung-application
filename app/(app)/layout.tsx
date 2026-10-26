import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { UserNav } from "@/components/user-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/termine" className="font-semibold tracking-tight">
            Kurseinteilung
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/termine" className="hover:underline">
              Termine
            </Link>
            <Link href="/profil" className="hover:underline">
              Profil
            </Link>
          </nav>
          <div className="ml-auto">
            <Suspense fallback={null}>
              <UserNav />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
