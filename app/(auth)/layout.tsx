import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:justify-center sm:py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Logo />
        {children}
      </div>
    </main>
  );
}
