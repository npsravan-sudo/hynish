import * as React from 'react';
import { cn } from '@/lib/utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { EmptyState, type EmptyStateProps } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';

export interface Column<T> {
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}

export interface DataListProps<T> {
  items: T[];
  getRowId: (item: T) => string;
  columns: Column<T>[];
  /** Mobile card renderer (Phase 4 §8/§17 — tables become cards, not a shrunk table). */
  renderCard: (item: T) => React.ReactNode;
  rowActions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;
  loading: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  empty: EmptyStateProps;
}

export function DataList<T>({
  items,
  getRowId,
  columns,
  renderCard,
  rowActions,
  onRowClick,
  loading,
  loadingMore,
  error,
  onRetry,
  hasMore,
  onLoadMore,
  empty,
}: DataListProps<T>) {
  if (loading) return <TableSkeleton rows={6} cols={columns.length} />;
  if (error) return <ErrorState message={error} {...(onRetry ? { onRetry } : {})} />;
  if (items.length === 0) return <EmptyState {...empty} />;

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.header} className={cn(c.align === 'right' && 'text-right', c.className)}>
                  {c.header}
                </TableHead>
              ))}
              {rowActions && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={getRowId(item)}
                className={onRowClick ? 'cursor-pointer' : undefined}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((c) => (
                  <TableCell key={c.header} className={cn(c.align === 'right' && 'num text-right', c.className)}>
                    {c.cell(item)}
                  </TableCell>
                ))}
                {rowActions && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {rowActions(item)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <div key={getRowId(item)}>{renderCard(item)}</div>
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} loading={!!loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
