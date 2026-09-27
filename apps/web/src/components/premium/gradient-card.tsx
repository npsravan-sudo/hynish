import * as React from 'react';
import { cn } from '@/lib/utils';
import { gradientClass, type GradientVariant } from './gradient';

export interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GradientVariant;
}

/**
 * Premium gradient surface (UI-UX §6). Text is always white for guaranteed contrast across
 * the whole gradient. A subtle radial highlight adds depth. Use sparingly (max ~4 per screen).
 */
export const GradientCard = React.forwardRef<HTMLDivElement, GradientCardProps>(
  ({ variant = 'sales', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-2xl p-5 text-white shadow-md sm:p-6',
        gradientClass[variant],
        'before:pointer-events-none before:absolute before:-right-8 before:-top-10 before:size-40 before:rounded-full before:bg-white/10 before:blur-2xl',
        className,
      )}
      {...props}
    >
      <div className="relative">{children}</div>
    </div>
  ),
);
GradientCard.displayName = 'GradientCard';
