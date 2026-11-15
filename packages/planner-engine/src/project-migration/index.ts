// Pure document transformations a project schema migration needs from engine facts.
// Only the migration runs them; nothing in evaluation, authoring or publication does.
export { fillNemesisBetOutcomeWins } from './nemesis-bet-outcome-wins';
export { moveLockedDoorFightOntoDoor } from './locked-door-fight';
export { exchangeBlockedWheelOffers, type WheelSideOrderBlock } from './wheel-side-order';
export { splitShrineRush } from './split-shrine-rush';
export { moveWellPoolRollsOntoObjects } from './well-pool-rolls';
export { moveRerollResultsOntoItems } from './reroll-results';
export { stampRoomActionItemContent } from './room-action-content';
export { stripEncounterPhaseKey } from './strip-encounter-phase-key';
export { dropRouteExcludedObjects } from './route-excluded-objects';
export { dropAutomaticRewardRows } from './automatic-reward-rows';
export { dropUnduplicableSeaStarDuplicates } from './unduplicable-sea-star-duplicates';
export { settleProjectFills, settleProjectUpgrade } from '../simulation/edit-settlement';
