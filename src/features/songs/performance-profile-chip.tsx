import type { PerformanceType, SongPerformanceProfile } from "../../domain/models";

import {
  comfortLevelClasses,
  formatComfortLevel,
} from "./song-ui";

interface PerformanceProfileChipProps {
  profile: SongPerformanceProfile;
  performanceTypes: PerformanceType[];
}

export function PerformanceProfileChip({
  profile,
  performanceTypes,
}: PerformanceProfileChipProps) {
  const performanceTypeName =
    performanceTypes.find((type) => type.id === profile.performanceTypeId)?.name ??
    "Unknown type";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${comfortLevelClasses(profile.comfortLevel)}`}
    >
      <span>{performanceTypeName}</span>
      <span className="opacity-75">{formatComfortLevel(profile.comfortLevel)}</span>
    </span>
  );
}
