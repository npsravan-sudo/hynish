import { MapPin } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';

const ALL_LOCATIONS_VALUE = '__all__';

/**
 * Working-location selector (Phase 1 §44). Restricted users (allowedLocationIds set)
 * see only their locations, and the "All locations" option is hidden — matching the legacy
 * fixed-label behavior (LC-50.10). Real enforcement arrives with auth in Phase 2.
 */
export function LocationSelector({ className }: { className?: string }) {
  const { locations, currentLocationId, allowedLocationIds, setCurrentLocation } = useAuthStore();

  const visible = allowedLocationIds
    ? locations.filter((l) => allowedLocationIds.includes(l.id))
    : locations;
  const restricted = allowedLocationIds !== null;

  // Restricted to exactly one location: show a fixed, non-interactive label.
  if (restricted && visible.length <= 1) {
    const only = visible[0];
    return (
      <div className={`flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm ${className ?? ''}`}>
        <MapPin className="size-4 text-muted-foreground" />
        <span className="font-medium">{only?.name ?? 'No location'}</span>
      </div>
    );
  }

  const value = currentLocationId ?? ALL_LOCATIONS_VALUE;

  return (
    <Select
      value={value}
      onValueChange={(v) => setCurrentLocation(v === ALL_LOCATIONS_VALUE ? null : v)}
    >
      <SelectTrigger className={className} aria-label="Select working location">
        <span className="flex items-center gap-2 truncate">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Locations</SelectLabel>
          {!restricted && <SelectItem value={ALL_LOCATIONS_VALUE}>All locations</SelectItem>}
          {visible.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
