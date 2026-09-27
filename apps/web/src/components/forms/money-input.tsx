import * as React from 'react';
import { Input } from '@/components/ui/input';
import { toRupees, toPaise } from '@hynish/domain';

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Value in integer paise. */
  valuePaise: number;
  onChangePaise: (paise: number) => void;
}

/** Rupee-facing input that stores integer paise (BR-MNY-01). Right-aligned, tabular. */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ valuePaise, onChangePaise, ...props }, ref) => {
    const [text, setText] = React.useState(() => (valuePaise ? String(toRupees(valuePaise)) : ''));

    // Keep text in sync when the paise value changes externally (e.g. form reset).
    React.useEffect(() => {
      const asPaise = toPaise(Number(text) || 0);
      if (asPaise !== valuePaise) setText(valuePaise ? String(toRupees(valuePaise)) : '');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [valuePaise]);

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          className="num pl-7 text-right"
          value={text}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, '');
            setText(raw);
            onChangePaise(toPaise(Number(raw) || 0));
          }}
          {...props}
        />
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
