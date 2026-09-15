'use client';

import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch, Category, Transaction, TransactionsPage as TransactionsPageData } from '@/lib/api';
import { CategoryIcon } from '@/components/category-icon';
import { useApiResource } from '@/lib/use-api-resource';
import { LoadError } from '@/components/load-error';

const SOURCE_LABEL: Record<string, string> = {
  RULE: 'Regra',
  LLM: 'IA',
  MANUAL: 'Manual',
  PLUGGY: 'Pluggy',
};

function SkeletonRow() {
  return (
    <tr>
      <td className="px-5 py-3">
        <div className="skeleton h-4 w-20" />
      </td>
      <td className="px-5 py-3">
        <div className="skeleton h-4 w-48" />
      </td>
      <td className="px-5 py-3">
        <div className="skeleton h-4 w-32" />
      </td>
      <td className="px-5 py-3 text-right">
        <div className="skeleton ml-auto h-4 w-20" />
      </td>
    </tr>
  );
}

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search) params.set('search', search);
  const resource = useApiResource<TransactionsPageData>(`/api/transactions?${params}`, 250);
  const categoryResource = useApiResource<Category[]>('/api/categories');
  const data = resource.data;
  const categories = categoryResource.data ?? [];

  async function updateCategory(tx: Transaction, categoryId: string) {
    if (saving) return;
    setSaving(tx.id);
    setSaveError(null);
    try {
      const updated = await apiFetch<Transaction>(`/api/transactions/${tx.id}`, {
        method: 'PATCH', body: JSON.stringify({ categoryId }),
      });
      resource.update((current) => ({ ...current, results: current.results.map((t) => t.id === tx.id ? updated : t) }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a categoria');
    } finally {
      setSaving(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight">Transações</h1>
        <div className="relative sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground"
            strokeWidth={1.75}
          />
          <input
            aria-label="Buscar transações por descrição"
            maxLength={200}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por descrição…"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-subtle-foreground focus:border-accent"
          />
        </div>
      </div>

      {saveError && <p role="alert" className="text-sm text-negative">{saveError}. Tente selecionar a categoria novamente.</p>}
      {categoryResource.error && <LoadError message={categoryResource.error} retry={categoryResource.reload} />}
      {resource.error ? <LoadError message={resource.error} retry={resource.reload} /> : <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Data</th>
              <th className="px-5 py-3 font-medium">Descrição</th>
              <th className="px-5 py-3 font-medium">Categoria</th>
              <th className="px-5 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.results.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-surface-hover">
                <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                  {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                </td>
                <td className="px-5 py-3">{t.description}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <CategoryIcon slug={t.category?.slug} className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <select
                      aria-label={`Categoria de ${t.description}`}
                      disabled={saving !== null || categories.length === 0}
                      value={t.categoryId ?? ''}
                      onChange={(e) => updateCategory(t, e.target.value)}
                      className="rounded border border-transparent bg-transparent py-0.5 text-sm outline-none hover:border-border focus:border-accent"
                    >
                      <option value="" disabled>
                        Sem categoria
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {t.categorizationSource && (
                      <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-subtle-foreground">
                        {SOURCE_LABEL[t.categorizationSource]}
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums ${
                    Number(t.amount) < 0 ? 'text-negative' : 'text-positive'
                  }`}
                >
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: t.currencyCode }).format(Number(t.amount))}
                </td>
              </tr>
            ))}
            {!data && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </tbody>
        </table>

        {data && data.total === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma transação encontrada.
          </p>
        )}
      </div>}

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.total} transaç{data.total === 1 ? 'ão' : 'ões'}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
                className="flex h-11 w-11 items-center justify-center rounded-md border border-border transition-colors hover:bg-surface-hover disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
                className="flex h-11 w-11 items-center justify-center rounded-md border border-border transition-colors hover:bg-surface-hover disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
