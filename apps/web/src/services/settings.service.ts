/**
 * Settings service (§42). Reads business settings through the repository (never Firestore
 * directly) and resolves the numbering configuration per series from the stored prefixes.
 * Writes go through the settings Cloud Function (later phase).
 */
import {
  SERIES_KEYS,
  normalizeSeriesConfig,
  type NumberingSeriesConfig,
  type BusinessSettings,
  type SeriesKey,
} from '@hynish/domain';
import { makeRepositories } from '@/infrastructure/repositories';

export function createSettingsService(businessId: string) {
  const repo = makeRepositories(businessId).businessSettings;
  return {
    get: () => repo.get(),
    watch: (cb: (s: BusinessSettings | null) => void, onError?: (e: Error) => void) => repo.watch(cb, onError),
    /**
     * Resolve the numbering config for every series from settings prefixes. Sequence values are
     * owned by the server counters (BR-NUM-05); the resolved config carries the prefix and the
     * default starting sequence, which the reserve-number function overrides atomically.
     */
    resolveNumbering(settings: BusinessSettings): Record<SeriesKey, NumberingSeriesConfig> {
      const out = {} as Record<SeriesKey, NumberingSeriesConfig>;
      for (const key of SERIES_KEYS) {
        out[key] = normalizeSeriesConfig(key, settings.prefixes[key], undefined);
      }
      return out;
    },
  };
}
export type SettingsService = ReturnType<typeof createSettingsService>;
