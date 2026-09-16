import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-brand-700">
            VENDEIA
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Painel administrativo
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
