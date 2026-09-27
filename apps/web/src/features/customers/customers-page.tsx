import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import { Users } from 'lucide-react';

export function CustomersPage() {
  return (
    <ModulePlaceholder
      title="Customers"
      description="Customer directory, ledger and dues."
      icon={Users}
      phase="Phase 3"
      legacyRefs={[
        'Blank GSTIN = B2C; GSTIN auto-suggests state (BR-GST-15/17).',
        'Credit limit warns, never blocks; snapshot frozen on invoice (BR-INV-06/08).',
        'Delete is a soft delete; invoices keep their snapshot (BR-CUS-02).',
      ]}
    />
  );
}
