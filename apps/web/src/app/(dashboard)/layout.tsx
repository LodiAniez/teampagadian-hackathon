import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Raket</span>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <a href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </a>
            <a href="/invoices" className="hover:text-slate-900">
              Invoices
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
