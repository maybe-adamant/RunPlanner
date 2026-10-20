/** Player names for authored biome settings. */
export function biomeFieldLabel(fieldKey: string): string {
  switch (fieldKey) {
    case 'maxNonGoalRewards':
      return 'Rolled non-goal limit';
    default:
      return fieldKey;
  }
}
