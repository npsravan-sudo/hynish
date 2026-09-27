import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import { BadgeIndianRupee } from 'lucide-react';

export function PayrollPage() {
  return (
    <ModulePlaceholder
      title="Payroll & Staff"
      description="Shop payroll and the named-staff directory."
      icon={BadgeIndianRupee}
      phase="Phase 5"
      legacyRefs={[
        'Shop payroll is keyed by location; no automatic commission (BR-PRL-01/02).',
        'Staff directory is separate from logins (LC-4.2).',
      ]}
    />
  );
}
