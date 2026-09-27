import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import { Users, History, Settings } from 'lucide-react';

export function UsersPage() {
  return (
    <ModulePlaceholder
      title="Users & Members"
      description="Roles, permissions and location access."
      icon={Users}
      phase="Phase 2"
      legacyRefs={[
        'owner / admin / shop roles; per-member permission overrides (BR-PRM-02..04).',
        'Membership provisioning & new roles are open questions (OQ-02).',
      ]}
    />
  );
}

export function ActivityPage() {
  return (
    <ModulePlaceholder
      title="Activity Log"
      description="Immutable, server-written audit trail."
      icon={History}
      phase="Phase 6"
      legacyRefs={['Server-written and immutable; last 300 with account filter (BR-ADM-04 / LC-39.1).']}
    />
  );
}

export function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Business Settings"
      description="Identity, numbering, bank details and preferences."
      icon={Settings}
      phase="Phase 2"
      legacyRefs={[
        'Business identity, bank details and 6 numbering series preserved (LC-2.1/2.2/2.3).',
        'GSTIN uppercased and auto-fills state; theme is Light/Dark/System (BR-GST-16 / LC-2.4).',
      ]}
    />
  );
}
