import { redirect } from "next/navigation";

import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";
import { auth } from "@/server/auth";

import { logout } from "./logout-action";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Defense in depth: the middleware already guards these routes.
  if (!session?.user) {
    redirect("/login");
  }

  const userLabel = session.user.name ?? session.user.email ?? "Conta";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav userLabel={userLabel} />
            <span className="text-lg font-bold tracking-tight text-brand-700 md:hidden">
              VENDEIA
            </span>
            <span className="hidden text-sm text-slate-500 md:inline">
              Painel administrativo
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[40vw] truncate text-sm font-medium sm:inline">
              {userLabel}
            </span>
            <form action={logout} className="hidden sm:block">
              <button
                type="submit"
                className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Sair
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
