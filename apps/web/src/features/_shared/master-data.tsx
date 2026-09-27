import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { Badge } from '@/components/ui/badge';

export type StatusFilter = 'active' | 'all';

/** List params for a name-ordered master-data query, optionally active-only (deletedAt == null). */
export function listParamsFor(status: StatusFilter, limit = 25): ListParams {
  return {
    orderByField: 'nameLower',
    direction: 'asc',
    limit,
    filters: status === 'active' ? [{ field: 'deletedAt', op: '==', value: null }] : [],
  };
}

/** Client-side substring search over loaded items (legacy parity, BR-RPT-08). Case-insensitive. */
export function clientSearch<T>(items: T[], term: string, fields: (item: T) => string[]): T[] {
  const q = term.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    fields(item).some((f) => (f ?? '').toLowerCase().includes(q)),
  );
}

/** Archived vs active badge for a soft-deletable record. */
export function ActiveBadge({ deletedAt }: { deletedAt: number | null }) {
  return deletedAt == null ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="secondary">Archived</Badge>
  );
}

/** True when a record is archived (soft-deleted). */
export function isArchived(record: { deletedAt: number | null }): boolean {
  return record.deletedAt != null;
}
