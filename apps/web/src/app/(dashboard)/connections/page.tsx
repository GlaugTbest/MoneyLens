'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Landmark, RefreshCw, Trash2, Plus } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';

// react-pluggy-connect (via zoid) touches `window` at module-evaluation time,
// which crashes Next's build-time prerendering of this page even though it's
// a client component — ssr:false defers loading it to the actual browser.
const PluggyConnect = dynamic(
  () => import('react-pluggy-connect').then((mod) => mod.PluggyConnect),
  { ssr: false },
);

interface Connection {
  id: string;
  connectorName: string;
  connectorImageUrl: string | null;
  status: string;
  executionStatus: string | null;
  lastSyncedAt: string | null;
  error: { code: string; message: string } | null;
}

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  UPDATING: { label: 'Sincronizando…', dot: 'bg-warning-foreground', text: 'text-warning-foreground' },
  UPDATED: { label: 'Conectado', dot: 'bg-positive', text: 'text-positive' },
  OUTDATED: { label: 'Precisa atualizar', dot: 'bg-subtle-foreground', text: 'text-muted-foreground' },
  LOGIN_ERROR: { label: 'Reconexão necessária', dot: 'bg-negative', text: 'text-negative' },
  WAITING_USER_INPUT: { label: 'Ação necessária', dot: 'bg-warning-foreground', text: 'text-warning-foreground' },
};

function SkeletonRow() {
  return (
    <li className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-9 w-9 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-3 w-40" />
        </div>
      </div>
      <div className="skeleton h-6 w-24 rounded-full" />
    </li>
  );
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [reconnectItemId, setReconnectItemId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    const data = await apiFetch<Connection[]>('/api/connections');
    setConnections(data);
  }, []);

  useEffect(() => {
    loadConnections().catch(() => setConnections([]));
  }, [loadConnections]);

  useEffect(() => {
    const hasUpdating = connections?.some((c) => c.status === 'UPDATING');
    if (!hasUpdating) return;
    const interval = setInterval(() => loadConnections().catch(() => undefined), 4000);
    return () => clearInterval(interval);
  }, [connections, loadConnections]);

  async function openWidget(itemId?: string) {
    setError(null);
    try {
      const { connectToken } = await apiFetch<{ connectToken: string }>(
        '/api/connections/connect-token',
        { method: 'POST', body: JSON.stringify({ itemId }) },
      );
      setReconnectItemId(itemId);
      setConnectToken(connectToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao iniciar conexão');
    }
  }

  async function registerConnection(itemId: string) {
    try {
      await apiFetch('/api/connections', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      });
      await loadConnections();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar conexão');
    }
  }

  async function handleWidgetSuccess(data: { item: { id: string } }) {
    setConnectToken(null);
    await registerConnection(data.item.id);
  }

  // onError também dispara quando o Item chega num status de falha (senha
  // errada, MFA pendente, erro transitório do sandbox) — não só em falha
  // geral de carregamento do widget. Nesse caso o Pluggy ainda manda o Item
  // em `error.data.item`, e vale registrá-lo (aparece com status LOGIN_ERROR/
  // WAITING_USER_INPUT e botão de reconectar) em vez de só mostrar um erro
  // genérico e descartar a tentativa.
  async function handleWidgetError(error: { message: string; data?: { item?: { id: string } } }) {
    setConnectToken(null);
    const itemId = error.data?.item?.id;
    if (itemId) {
      await registerConnection(itemId);
    } else {
      setError('Erro no widget de conexão');
    }
  }

  async function handleSync(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/connections/${id}/sync`, { method: 'POST' });
      await loadConnections();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao sincronizar');
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/connections/${id}`, { method: 'DELETE' });
      await loadConnections();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao remover conexão');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight">Conexões</h1>
        <button
          onClick={() => openWidget(undefined)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Conectar novo banco
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-foreground">
          {error}
        </p>
      )}

      {connections === null ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface shadow-sm">
          <SkeletonRow />
          <SkeletonRow />
        </ul>
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
          <Landmark className="h-8 w-8 text-subtle-foreground" strokeWidth={1.5} />
          <p className="max-w-sm text-sm text-muted-foreground">
            Nenhuma conexão ainda. Use o sandbox do Pluggy — usuário{' '}
            <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs">user-ok</code>{' '}
            e senha{' '}
            <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs">password-ok</code>.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {connections.map((c) => {
            const meta = STATUS_META[c.status] ?? {
              label: c.status,
              dot: 'bg-subtle-foreground',
              text: 'text-muted-foreground',
            };
            const needsReconnect = c.status === 'LOGIN_ERROR' || c.status === 'WAITING_USER_INPUT';
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint">
                    <Landmark className="h-4 w-4 text-accent" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{c.connectorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.lastSyncedAt
                        ? `Sincronizado ${new Date(c.lastSyncedAt).toLocaleString('pt-BR')}`
                        : 'Ainda não sincronizado'}
                    </p>
                    {c.error && <p className="text-xs text-negative">{c.error.message}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  {needsReconnect ? (
                    <button
                      onClick={() => openWidget(c.id)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Reconectar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSync(c.id)}
                      aria-label="Sincronizar"
                      title="Sincronizar"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(c.id)}
                    aria-label="Remover"
                    title="Remover"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-warning-bg hover:text-negative"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox
          updateItem={reconnectItemId}
          onSuccess={handleWidgetSuccess}
          onError={handleWidgetError}
          onClose={() => setConnectToken(null)}
        />
      )}
    </div>
  );
}
