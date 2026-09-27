import { Badge, type BadgeProps } from '@/components/ui/badge';

/**
 * Maps legacy business statuses to badge tints (UI-UX §3.1). Centralized so a status is
 * never coloured inconsistently across screens.
 */
export type BusinessStatus =
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'overdue'
  | 'due-soon'
  | 'no-due-date'
  | 'current'
  | 'healthy'
  | 'low-stock'
  | 'out-of-stock'
  | 'over-limit'
  | 'without-gst'
  | 'gst'
  | 'pending'
  | 'invoiced'
  | 'returned'
  | 'converted'
  | 'open';

const STATUS_MAP: Record<BusinessStatus, { label: string; variant: BadgeProps['variant'] }> = {
  paid: { label: 'Paid', variant: 'success' },
  healthy: { label: 'Healthy', variant: 'success' },
  current: { label: 'Current', variant: 'success' },
  partial: { label: 'Partial', variant: 'warning' },
  'due-soon': { label: 'Due Soon', variant: 'warning' },
  'low-stock': { label: 'Low Stock', variant: 'warning' },
  'over-limit': { label: 'Over Limit', variant: 'danger' },
  unpaid: { label: 'Unpaid', variant: 'danger' },
  overdue: { label: 'Overdue', variant: 'danger' },
  'out-of-stock': { label: 'Out of Stock', variant: 'danger' },
  'no-due-date': { label: 'No Due Date', variant: 'secondary' },
  'without-gst': { label: 'Without GST', variant: 'info' },
  gst: { label: 'GST', variant: 'default' },
  pending: { label: 'Pending', variant: 'info' },
  open: { label: 'Open', variant: 'info' },
  invoiced: { label: 'Invoiced', variant: 'secondary' },
  returned: { label: 'Returned', variant: 'secondary' },
  converted: { label: 'Converted', variant: 'secondary' },
};

export function StatusBadge({ status, className }: { status: BusinessStatus; className?: string }) {
  const { label, variant } = STATUS_MAP[status];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
