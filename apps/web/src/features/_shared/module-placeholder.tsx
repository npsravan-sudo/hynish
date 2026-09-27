import { Construction, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { EmptyState } from '@/components/feedback/empty-state';

export interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  /** Phase in which this module is implemented (informational only). */
  phase?: string;
  /** Legacy references this module must preserve (LEGACY-COMPATIBILITY / BUSINESS-RULES). */
  legacyRefs?: string[];
}

/**
 * Reusable placeholder for modules whose real functionality arrives in later phases
 * (Phase 1 §8). It proves navigation, layout and permissions WITHOUT any fake business data
 * or fake actions. It also surfaces the legacy references the future implementation must honor.
 */
export function ModulePlaceholder({
  title,
  description,
  icon = Construction,
  phase,
  legacyRefs,
}: ModulePlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <SectionCard>
        <EmptyState
          icon={icon}
          title={`${title} — coming soon`}
          description={
            phase
              ? `This module is scheduled for ${phase}. The shell, routing and permissions are ready.`
              : 'The shell, routing and permissions are ready. Functionality arrives in a later phase.'
          }
        />
        {legacyRefs && legacyRefs.length > 0 && (
          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Legacy behavior to preserve
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              {legacyRefs.map((ref) => (
                <li key={ref} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{ref}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
