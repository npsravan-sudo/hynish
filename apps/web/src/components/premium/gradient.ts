/** Premium gradient variants (UI-UX §6). Defined once; components reference by key. */
export const GRADIENT_VARIANTS = [
  'sales',
  'revenue',
  'profit',
  'expense',
  'inventory',
  'customer',
  'warning',
  'info',
] as const;

export type GradientVariant = (typeof GRADIENT_VARIANTS)[number];

export const gradientClass: Record<GradientVariant, string> = {
  sales: 'bg-gradient-sales',
  revenue: 'bg-gradient-revenue',
  profit: 'bg-gradient-profit',
  expense: 'bg-gradient-expense',
  inventory: 'bg-gradient-inventory',
  customer: 'bg-gradient-customer',
  warning: 'bg-gradient-warning',
  info: 'bg-gradient-info',
};
