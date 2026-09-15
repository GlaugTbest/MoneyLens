'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const [error, setError] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
    {error && <span role="alert" className="text-xs">Falha ao sair. Tente novamente.</span>}
    <button
      onClick={handleLogout}
      disabled={pending}
      aria-label="Sair"
      title="Sair"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground disabled:opacity-40"
    >
      <LogOut className="h-4 w-4" strokeWidth={1.75} />
    </button>
    </div>
  );
}
