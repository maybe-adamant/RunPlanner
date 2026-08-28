import type { WorkspaceMarker, WorkspaceRewardControl } from '../contract';

/**
 * The occurrence assembler publishes all reward-child marker destinations so
 * navigation does not depend on which action row currently renders a reward.
 */
export function rewardChildMarkers(control: WorkspaceRewardControl): readonly WorkspaceMarker[] {
  const markers: WorkspaceMarker[] = [];
  for (const trait of control.traitOffers ?? []) {
    markers.push(trait.marker);
    if (trait.traitAcquisitionTarget !== undefined)
      markers.push(trait.traitAcquisitionTarget.marker);
    if (trait.circeResolution !== undefined) markers.push(trait.circeResolution.marker);
    if (trait.echoPomTarget !== undefined) markers.push(trait.echoPomTarget.marker);
    if (trait.echoLastRunBoon !== undefined) markers.push(trait.echoLastRunBoon.marker);
    if (trait.echoLastReward !== undefined) markers.push(trait.echoLastReward.marker);
    for (const set of trait.allTogetherSets ?? []) markers.push(set.marker);
    if (trait.naturalSelection !== undefined) markers.push(trait.naturalSelection.marker);
  }
  for (const resolution of control.levelResolutions ?? []) markers.push(resolution.marker);
  for (const conversion of control.conversions ?? []) markers.push(conversion.marker);
  return Object.freeze(markers);
}
