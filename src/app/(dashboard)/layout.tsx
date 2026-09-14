import { redirect } from "next/navigation";

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <span className="text-sm text-slate-500">Painel administrativo</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {session.user.name ?? session.user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Sair
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
