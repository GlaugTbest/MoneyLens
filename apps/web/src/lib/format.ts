export function formatBRL(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Os períodos vêm truncados por mês em UTC (date_trunc no Postgres) — formatar
// no fuso local faria meses "vazarem" para o mês anterior perto da virada.
export function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}
