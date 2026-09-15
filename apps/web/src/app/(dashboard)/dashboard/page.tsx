'use client';

import Link from 'next/link';
import { ArrowUpRight, TrendingUp, RefreshCw, TriangleAlert } from 'lucide-react';
import { InsightsSummary } from '@/lib/api';
import { formatBRL } from '@/lib/format';
import { CategoryIcon } from '@/components/category-icon';
import { SpendBarChart } from '@/components/spend-bar-chart';
import { useApiResource } from '@/lib/use-api-resource';
import { LoadError } from '@/components/load-error';

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function DashboardPage() {
  const summaryResource = useApiResource<InsightsSummary>('/api/insights/summary');
  const connectionsResource = useApiResource<unknown[]>('/api/connections');
  const summary = summaryResource.data;
  const hasConnections = connectionsResource.data ? connectionsResource.data.length > 0 : null;
  if (summaryResource.error || connectionsResource.error) {
    return <LoadError message={summaryResource.error ?? connectionsResource.error ?? ''} retry={() => { summaryResource.reload(); connectionsResource.reload(); }} />;
  }

  if (hasConnections === false) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint">
          <TrendingUp className="h-6 w-6 text-accent" strokeWidth={1.75} />
        </div>
        <h1 className="text-lg font-semibold">Conecte sua primeira conta</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Conecte um banco pelo sandbox do Pluggy para ver seus gastos, assinaturas e categorias
          aparecerem aqui automaticamente.
        </p>
        <Link
          href="/connections"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Conectar um banco
          <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    );
  }

  const evolution = summary?.spendEvolution ?? [];
  const lastMonth = evolution.at(-1)?.totalSpent ?? 0;


  return (
    <div className="space-y-8">
      <div><h1 className="text-[22px] font-semibold tracking-tight">Visão geral</h1><p className="mt-1 text-sm text-muted-foreground">Saídas em BRL, incluindo transferências e pagamentos de fatura. Valores de demonstração.</p></div>

      <section className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm sm:grid-cols-[220px_1fr]">
        <div className="flex flex-col justify-center gap-2 border-b border-border p-6 sm:border-b-0 sm:border-r">
          <p className="text-xs font-medium text-muted-foreground">Saídas deste mês</p>
          {summary ? (
            <>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {formatBRL(lastMonth)}
              </p>
              <p className="text-xs text-muted-foreground">Mês em andamento · BRL</p>
            </>
          ) : (
            <SkeletonBlock className="h-8 w-28" />
          )}
        </div>

        <div className="p-6">
          {summary ? (
            <SpendBarChart data={evolution} />
          ) : (
            <SkeletonBlock className="h-[160px] w-full" />
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-[13px] font-medium text-muted-foreground">Maiores categorias · últimos 6 meses</h2>
          <ul className="space-y-3.5">
            {summary?.topCategories.map((c) => (
              <li key={c.categoryId ?? 'none'} className="flex items-center gap-3">
                <CategoryIcon slug={c.categorySlug} className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{c.categoryName}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${c.percentage * 100}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {formatBRL(c.totalSpent)}
                </span>
              </li>
            ))}
            {!summary &&
              Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-4 w-full" />)}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-muted-foreground">Recorrências &amp; alertas</h2>
            <Link href="/insights" className="text-xs font-medium text-accent hover:underline">
              Ver tudo
            </Link>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-accent-tint px-3 py-2.5">
            <RefreshCw className="h-4 w-4 text-accent" strokeWidth={1.75} />
            <p className="text-sm">
              <span className="font-semibold">{summary?.recurringCount ?? 0}</span> despesas
              recorrentes ·{' '}
              <span className="font-medium">{formatBRL(summary?.recurringMonthlyTotal ?? 0)}</span>
              /mês estimado
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {summary?.anomalies.length === 0 && (
              <p className="px-1 text-sm text-muted-foreground">
                Nada fora do padrão este mês.
              </p>
            )}
            {summary?.anomalies.map((a) => (
              <div
                key={a.categoryId}
                className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5"
              >
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground"
                  strokeWidth={1.75}
                />
                <p className="text-sm text-warning-foreground">
                  <span className="font-semibold">{a.categoryName}</span> em {formatBRL(a.current)}
                  {a.deltaPct !== null && ` (+${Math.round(a.deltaPct * 100)}% vs. média)`}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
