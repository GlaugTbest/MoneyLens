export interface PluggyConnectorSummary {
  id: number;
  name: string;
  imageUrl?: string;
  primaryColor?: string;
  type: string;
}

export interface PluggyItem {
  id: string;
  connector: PluggyConnectorSummary;
  status: 'UPDATING' | 'UPDATED' | 'LOGIN_ERROR' | 'OUTDATED' | 'WAITING_USER_INPUT' | string;
  executionStatus: string | null;
  createdAt: string;
  updatedAt: string;
  lastUpdatedAt: string | null;
  webhookUrl: string | null;
  error: { code: string; message: string } | null;
  clientUserId: string | null;
}

export interface PluggyAccount {
  id: string;
  itemId: string;
  type: 'BANK' | 'CREDIT';
  subtype: string | null;
  name: string;
  number: string | null;
  balance: number;
  currencyCode: string;
  marketingName?: string | null;
  taxNumber?: string | null;
  owner?: string | null;
  bankData?: unknown;
  creditData?: unknown;
}

export interface PluggyAccountsResponse {
  total: number;
  totalPages: number;
  page: number;
  results: PluggyAccount[];
}

export interface PluggyMerchant {
  cnae?: string | null;
  cnpj?: string | null;
  category?: string | null;
  businessName?: string | null;
}

export interface PluggyTransaction {
  id: string;
  description: string;
  descriptionRaw: string | null;
  currencyCode: string;
  amount: number;
  date: string;
  category: string | null;
  categoryId: string | null;
  accountId: string;
  status: string;
  paymentData: unknown;
  type: 'DEBIT' | 'CREDIT';
  merchant: PluggyMerchant | null;
  creditCardMetadata: { cardNumber?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PluggyTransactionsPage {
  results: PluggyTransaction[];
  next: string | null;
}
