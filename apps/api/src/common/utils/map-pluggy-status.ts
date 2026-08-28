import { ItemStatus } from '@prisma/client';

const KNOWN_STATUSES: ItemStatus[] = [
  'UPDATING',
  'UPDATED',
  'LOGIN_ERROR',
  'OUTDATED',
  'WAITING_USER_INPUT',
  'DELETED',
];

export function mapPluggyStatus(status: string): ItemStatus {
  return (KNOWN_STATUSES as string[]).includes(status) ? (status as ItemStatus) : 'OUTDATED';
}
