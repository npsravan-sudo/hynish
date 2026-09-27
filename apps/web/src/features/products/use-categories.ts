/**
 * Category options for the product form (Phase 4). Legacy has no separate ProductCategory entity —
 * categories are free-text strings on products. So the option list is DERIVED from existing products
 * via a bounded repository read (no full-collection scan): distinct, non-empty categories, sorted.
 * The form's Combobox still allows free-text entry, so a brand-new category needs no round-trip.
 */
import { useEffect, useState } from 'react';
import type { ComboboxOption } from '@/components/ui/combobox';
import { useRepositories } from '@/hooks/use-master-data';

const SCAN_LIMIT = 500;

export function useCategoryOptions(): ComboboxOption[] {
  const repos = useRepositories();
  const [options, setOptions] = useState<ComboboxOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void repos.products
      .list({ orderByField: 'nameLower', direction: 'asc', limit: SCAN_LIMIT, filters: [] })
      .then((page) => {
        if (cancelled) return;
        const seen = new Set<string>();
        for (const p of page.items) {
          const c = p.category.trim();
          if (c) seen.add(c);
        }
        setOptions(
          [...seen]
            .sort((a, b) => a.localeCompare(b))
            .map((c) => ({ value: c, label: c })),
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repos]);

  return options;
}
