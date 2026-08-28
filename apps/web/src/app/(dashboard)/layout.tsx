'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Landmark, ArrowLeftRight, Sparkles } from 'lucide-react';
import { apiFetch, MeResponse } from '@/lib/api';
import { LogoutButton } from '@/components/logout-button';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutGrid },
  { href: '/connections', label: 'Conexões', icon: Landmark },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/insights', label: 'Insights', icon: Sparkles },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    apiFetch<MeResponse>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Mobile top bar: brand + logout. Nav moves to a bottom tab bar below md. */}
      <div className="flex h-14 shrink-0 items-center justify-between bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[13px] font-bold text-accent-foreground">
            M
          </span>
          <span className="text-[15px] font-semibold tracking-tight">MoneyLens</span>
        </div>
        <LogoutButton />
      </div>

      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2 px-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[13px] font-bold text-accent-foreground">
            M
          </span>
          <span className="text-[15px] font-semibold tracking-tight">MoneyLens</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-active text-sidebar-foreground'
                    : 'text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground'
                }`}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] text-sidebar-foreground">{user?.email ?? ' '}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col pb-16 md:pb-0">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? 'text-sidebar-foreground' : 'text-sidebar-muted'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
