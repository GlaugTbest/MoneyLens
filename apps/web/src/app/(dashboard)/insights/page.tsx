'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import { InsightsReport } from '@/lib/api';
import { formatBRL } from '@/lib/format';
import { CategoryIcon } from '@/components/category-icon';
import { SpendBarChart } from '@/components/spend-bar-chart';
import { useApiResource } from '@/lib/use-api-resource';
import { LoadError } from '@/components/load-error';

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function InsightsPage() {
  const { data: report, error, reload } = useApiResource<InsightsReport>('/api/insights/report');
  if (error) return <LoadError message={error} retry={reload} />;

  const evolution = report?.spendEvolution ?? null;
  const topCategories = report?.topCategories ?? null;
  const recurring = report?.recurring ?? null;
  const anomalies = report?.anomalies ?? null;
  const concentration = report?.concentration ?? null;


  return (
    <div className="space-y-10">
      <div><h1 className="text-[22px] font-semibold tracking-tight">Insights</h1><p className="mt-1 text-sm text-muted-foreground">Estimativas por heurísticas sobre saídas em BRL. Alertas precisam de pelo menos 3 meses com movimento na categoria.</p></div>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-5 text-[13px] font-medium text-muted-foreground">Saídas · últimos 6 meses</h2>
        {evolution ? (
          evolution.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <SpendBarChart data={evolution} />
          )
        ) : (
          <SkeletonBlock className="h-[160px] w-full" />
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-medium text-muted-foreground">Maiores categorias</h2>
          {concentration && (
            <span className="text-xs text-subtle-foreground">
              Top 3 concentram {Math.round(concentration.top3Share * 100)}% dos gastos
            </span>
          )}
        </div>
        <ul className="space-y-3.5">
          {topCategories
            ? topCategories.map((c) => (
                <li key={c.categoryId ?? 'none'} className="flex items-center gap-3">
                  <CategoryIcon slug={c.categorySlug} className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.categoryName}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${c.percentage * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {formatBRL(c.totalSpent)}
                  </span>
                </li>
              ))
            : Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-4 w-full" />)}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-[13px] font-medium text-muted-foreground">
          Despesas recorrentes / assinaturas
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {recurring?.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-tint">
                <CategoryIcon slug={r.category?.slug} className="h-4 w-4 text-accent" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium capitalize">{r.normalizedMerchant}</p>
                <p className="text-xs text-muted-foreground">
                  {r.category?.name ?? 'Sem categoria'} · a cada ~{r.intervalDays} dias
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">{formatBRL(r.averageAmount)}</span>
            </li>
          ))}
          {recurring?.length === 0 && (
            <li className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              Nenhuma recorrência detectada ainda.
            </li>
          )}
          {!recurring &&
            Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="px-5 py-3.5">
                <SkeletonBlock className="h-8 w-full" />
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-[13px] font-medium text-muted-foreground">Gastos fora do padrão</h2>
        {anomalies?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta identificado no histórico disponível.</p>
        ) : (
          <ul className="space-y-2">
            {anomalies?.map((a) => (
              <li
                key={a.categoryId}
                className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-4 py-3"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" strokeWidth={1.75} />
                <p className="text-sm text-warning-foreground">
                  <span className="font-semibold">{a.categoryName}</span>: {formatBRL(a.current)} este
                  mês vs. média de {formatBRL(a.mean)}
                  {a.deltaPct !== null && ` (+${Math.round(a.deltaPct * 100)}%)`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
