/**
 * Typed query/filter abstractions for list pages (§48–§50). Deliberately small and extensible —
 * NOT a generic query engine. Designed for Firestore cursor pagination (§49): repositories page
 * with an opaque cursor, never by downloading whole collections.
 */
export type SortDirection = 'asc' | 'desc';

export interface Sort<TField extends string = string> {
  field: TField;
  direction: SortDirection;
}

export interface DateRange {
  from?: string | undefined; // 'YYYY-MM-DD'
  to?: string | undefined;
}

/** Request one page. `cursor` is an opaque token from the previous page's `nextCursor`. */
export interface PageRequest {
  limit: number;
  cursor?: string | null | undefined;
}

/** A page of results plus the cursor to fetch the next one (null when exhausted). */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Firestore supports only prefix/equality/range filtering, not arbitrary full-text search. List
 * queries carry a small, indexed filter set; free-text search is done client-side over already
 * loaded collections (products/customers) or by `searchTokens` prefix match for historical docs
 * (ARCHITECTURE §8.4). This type documents the supported, indexable filters only.
 */
export interface ListFilter {
  /** Prefix/token search against the entity's `searchTokens` (indexed), lower-cased. */
  searchToken?: string | undefined;
  locationId?: string | undefined;
  status?: string | undefined;
  dateRange?: DateRange | undefined;
  /** Exclude soft-deleted records (default true). */
  includeArchived?: boolean | undefined;
}

export const DEFAULT_PAGE_LIMIT = 25;
