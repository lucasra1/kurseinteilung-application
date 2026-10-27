import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { AppNav, UserLink } from "@/components/app-nav";
import { Logo } from "@/components/logo";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-4">
          <Link href="/termine" className="rounded-lg">
            <Logo />
          </Link>
          <Suspense fallback={null}>
            <AppNav variant="header" />
          </Suspense>
          <div className="ml-auto">
            <Suspense fallback={<div className="size-10" />}>
              <UserLink />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:pt-8 md:pb-16">
        {children}
      </main>
      <Suspense fallback={null}>
        <AppNav variant="tabbar" />
      </Suspense>
    </div>
  );
}
