import LoginForm from "./LoginForm";

export const metadata = { title: "Admin login" };

export default function AdminLoginPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm glass rounded-2xl p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">Restricted</p>
          <h1 className="font-[family-name:var(--font-bebas)] text-3xl tracking-[0.18em] uppercase">
            Admin
          </h1>
          <div className="w-10 h-px bg-white/30" />
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
