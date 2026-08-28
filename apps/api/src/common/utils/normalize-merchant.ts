const DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizeMerchant(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .replace(/\*/g, ' ')
    .replace(/\b(ltda|me|sa|eireli)\b/g, ' ')
    .replace(/\d{4,}/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
