// Sempre relativo: o navegador só fala com a própria origem do Next.js, que
// encaminha /api/* pro backend via rewrite (next.config.ts) — isso evita que
// o cookie httpOnly de sessão vire um cookie cross-site em produção.
const API_URL = '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

// Compartilhada entre chamadas concorrentes para não disparar N refreshes em
// paralelo quando várias requisições batem 401 ao mesmo tempo (ex.: várias
// seções da página buscando dados juntas após o access token expirar).
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

  let res = await doFetch();

  // Access token (15min) expirou no meio da sessão — tenta renovar via
  // refresh token (cookie httpOnly, 7d) e repete a chamada uma vez.
  if (res.status === HTTP_UNAUTHORIZED && !AUTH_ENDPOINTS.includes(path)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? `Erro ${res.status}`);
  }

  if (res.status === HTTP_NO_CONTENT) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface MeResponse {
  id: string;
  email: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface Account {
  id: string;
  name: string;
  type: 'BANK' | 'CREDIT';
  subtype: string | null;
  balance: string;
  currencyCode: string;
  number: string | null;
}

export interface Transaction {
  id: string;
  description: string;
  merchantName: string | null;
  amount: string;
  type: 'DEBIT' | 'CREDIT';
  date: string;
  accountId: string;
  categoryId: string | null;
  category: Category | null;
  categorizationSource: 'RULE' | 'LLM' | 'MANUAL' | 'PLUGGY' | null;
}

export interface TransactionsPage {
  total: number;
  page: number;
  pageSize: number;
  results: Transaction[];
}

export interface SpendEvolutionPoint {
  period: string;
  totalSpent: number;
}

export interface TopCategory {
  categoryId: string | null;
  categoryName: string;
  categorySlug: string | null;
  totalSpent: number;
  percentage: number;
}

export interface RecurringGroup {
  id: string;
  normalizedMerchant: string;
  averageAmount: string;
  intervalDays: number;
  confidence: number;
  status: string;
  category: Category | null;
}

export interface Anomaly {
  categoryId: string;
  categoryName: string;
  current: number;
  mean: number;
  stdDev: number;
  deltaPct: number | null;
}

export interface InsightsReport {
  spendEvolution: SpendEvolutionPoint[];
  topCategories: TopCategory[];
  concentration: { totalSpent: number; top3Share: number; herfindahlIndex: number };
  recurring: RecurringGroup[];
  anomalies: Anomaly[];
}

export interface InsightsSummary {
  spendEvolution: SpendEvolutionPoint[];
  topCategories: TopCategory[];
  recurringCount: number;
  recurringMonthlyTotal: number;
  anomalies: Anomaly[];
}
