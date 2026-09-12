import type { WorkspaceRewardControl, WorkspaceTraitOfferControl } from '../contract';
import type { WorkspaceMarker } from '../contracts/navigation';

/** Exact finding owners edited through one trait launcher. */
export function traitOfferMarkers(trait: WorkspaceTraitOfferControl): readonly WorkspaceMarker[] {
  return Object.freeze([
    trait.marker,
    ...trait.children.map((child) => child.marker),
    ...trait.feedback.flatMap((feedback) =>
      feedback.kind === 'echoLastReward' ? [feedback.control.marker] : [],
    ),
  ]);
}

/**
 * The occurrence assembler publishes all reward-child marker destinations so
 * navigation does not depend on which action row currently renders a reward.
 */
export function rewardChildMarkers(control: WorkspaceRewardControl): readonly WorkspaceMarker[] {
  const markers: WorkspaceMarker[] = [];
  for (const trait of control.traitOffers ?? []) {
    markers.push(...traitOfferMarkers(trait));
  }
  for (const resolution of control.levelResolutions ?? []) markers.push(resolution.marker);
  for (const conversion of control.conversions ?? []) markers.push(conversion.marker);
  return Object.freeze(markers);
}
