import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import { BarChart3 } from 'lucide-react';

export function ReportsPage() {
  return (
    <ModulePlaceholder
      title="Reports"
      description="Sales reports, shop comparison and exports."
      icon={BarChart3}
      phase="Phase 6"
      legacyRefs={[
        'Sales reports scoped to the working location (BR-RPT-04).',
        'Shop comparison pulls the double-entry ledger (BR-ACC-20).',
      ]}
    />
  );
}
