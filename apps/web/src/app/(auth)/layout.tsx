export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
            M
          </span>
          <span className="text-[17px] font-semibold tracking-tight">MoneyLens</span>
        </div>
        <div className="rounded-xl border border-border bg-surface p-7 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
