'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={pending}
      aria-label="Sair"
      title="Sair"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground disabled:opacity-40"
    >
      <LogOut className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
