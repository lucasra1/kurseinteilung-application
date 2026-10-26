import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <p className="text-lg font-semibold tracking-tight">Kurseinteilung</p>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
