/** Phase findings repaired by its customization launcher rather than its encounter identity. */
export const isCompositionFinding = (finding: { readonly code: string }): boolean =>
  finding.code === 'encounterCustomizationUnavailable' ||
  finding.code === 'encounterCustomizationRequired' ||
  finding.code === 'encounterIntroductionRequired';

/** Phase findings repaired by the control that selects its encounter. */
export const isIdentityFinding = (finding: { readonly code: string }): boolean =>
  !isCompositionFinding(finding);
