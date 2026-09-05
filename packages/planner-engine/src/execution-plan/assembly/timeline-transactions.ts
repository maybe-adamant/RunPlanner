import {
  createBiomeAddress,
  createEchoKeepsakeReplayAddress,
  createEncounterPhaseAddress,
  createLevelResolutionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  semanticAddressKey,
} from '../../authored-project/addresses';
import type { TraitOfferOwnerAddress } from '../../authored-project/addresses';
import { nemesisGeneratedPickupSiteKey } from '../../authored-project/pickup-producers';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation-products';
import type { RewardEvent } from '../../simulation/rewards/model';
import type { PlannerTimelineFacts } from '../../simulation/timeline-facts';
import {
  appendSteadyGrowthTimelineEffects,
  appendTranscendentEmbryoTimelineEffects,
} from '../../simulation/room-actions';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import { agreement, executionRoomOwnerKey } from './support';
import { assembleLifecycleWindow } from './lifecycle';
import { executionKeepsakeEquipResults, executionRewardFromOffer } from './overview';
import type {
  ExecutionAcquisitionRole,
  ExecutionLevelResolution,
  ExecutionTimelineTransaction,
  ExecutionTraitOffer,
} from '../model';

/** Build typed execution transactions directly from lifecycle actions and outcomes. */
export function executionTimelineTransactions(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
  timelineFacts: PlannerTimelineFacts,
): readonly ExecutionTimelineTransaction[] {
  if (!room.entered) return Object.freeze([]);
  const owner = executionRoomOwnerKey(room);
  const sourceForAction = (actionOwner: (typeof room.roomActionRoster.rows)[number]['owner']) =>
    actionOwner.kind === 'acquisitionRole' ? actionOwner.owner : actionOwner;
  const traitOffer = (
    source: TraitOfferOwnerAddress,
    role: string,
  ): ExecutionTraitOffer | undefined => {
    const matches = biome.rewards.selectedTraitOffers.filter(
      (candidate) =>
        semanticAddressKey(candidate.address) ===
        semanticAddressKey(createTraitOfferAddress(source, role)),
    );
    if (matches.length > 1)
      throw new CompilerError(
        'executionCoverageMissing',
        `duplicate trait offer ${semanticAddressKey(createTraitOfferAddress(source, role))}`,
      );
    const selected = matches[0];
    if (selected === undefined) return undefined;
    if (selected.offer.kind === 'fallbackGold')
      return Object.freeze({ kind: 'fallbackGold' as const, giver: selected.offer.giverKey });
    if (selected.offer.kind === 'chaos')
      return Object.freeze({
        kind: 'chaos' as const,
        giver: 'Chaos' as const,
        curseOptions: Object.freeze(
          selected.offer.curseOptions.map((option) =>
            Object.freeze({ curseKey: option.curseKey, requirementCount: option.requirementCount }),
          ),
        ),
        selected: selected.offer.selectedOptionKey,
        selectedCurseValues: Object.freeze({ ...selected.offer.selectedCurseValues }),
        blessingKey: selected.offer.blessingKey,
        rarity: selected.offer.rarity,
        blessingValues: Object.freeze({ ...selected.offer.blessingValues }),
      });
    if (selected.offer.kind !== 'traits')
      throw new CompilerError(
        'executionCoverageMissing',
        `unsupported trait offer ${semanticAddressKey(selected.address)}`,
      );
    const selectedTraitOffer = selected.offer;
    const levels = agreement(
      selected.branches.map((branch) => branch.effectiveLevels),
      `trait effective levels ${semanticAddressKey(selected.address)}`,
    );
    const baseRarities = agreement(
      selected.branches.map((branch) => branch.baseRarities),
      `trait base rarities ${semanticAddressKey(selected.address)}`,
    );
    const replacements = agreement(
      selected.branches.map((branch) =>
        branch.assessments.map((assessment) => assessment.replacementTransition),
      ),
      `trait replacements ${semanticAddressKey(selected.address)}`,
    );
    const selectedOptionIndex = Number(selected.offer.selectedOptionKey.slice(-1)) - 1;
    const selectedOption = selected.offer.options[selectedOptionIndex];
    const authoredCirceResolution = selectedOption?.circeResolution;
    const circeResolution =
      authoredCirceResolution === undefined
        ? undefined
        : authoredCirceResolution.kind === 'disableFear'
          ? authoredCirceResolution.vowKey === null
            ? (() => {
                throw new CompilerError(
                  'executionCoverageMissing',
                  `Circe Fear resolution is incomplete for ${semanticAddressKey(selected.address)}`,
                );
              })()
            : Object.freeze({
                kind: 'disableFear' as const,
                vowKey: authoredCirceResolution.vowKey,
              })
          : Object.freeze({
              kind: authoredCirceResolution.kind,
              arcanaKeys: Object.freeze([...authoredCirceResolution.arcanaKeys]),
            });
    const targetedAcquisitionTransitions = selected.branches.map(
      (branch) => branch.targetedAcquisition.transition,
    );
    const targetedAcquisition = targetedAcquisitionTransitions.every(
      (transition) => transition === undefined,
    )
      ? undefined
      : agreement(
          targetedAcquisitionTransitions,
          `trait targeted acquisition ${semanticAddressKey(selected.address)}`,
        );
    const icarusHammerTarget =
      selected.offer.giverKey === 'Icarus' &&
      selectedOption?.traitKey === 'UpgradeHammerBoon' &&
      targetedAcquisition?.kind === 'upgradeHammerToRank2'
        ? targetedAcquisition.targetTraitKey
        : undefined;
    const echoPomTarget =
      selected.offer.giverKey === 'Echo' && selectedOption?.traitKey === 'EchoDoubleLevelBoon'
        ? selectedOption.echoPomTarget
        : undefined;
    const echoLastRunBoon =
      selected.offer.giverKey === 'Echo' && selectedOption?.traitKey === 'EchoLastRunBoon'
        ? agreement(
            selected.branches.map((branch) => branch.effectiveEchoLastRunBoon),
            `Echo last-run boon ${semanticAddressKey(selected.address)}`,
          )
        : undefined;
    const publishedHexTree =
      selected.offer.giverKey !== 'SpellDrop' || selected.offer.hexTree === undefined
        ? undefined
        : (() => {
            const progress = agreement(
              selected.branches.map((branch) => branch.settledHexTree),
              `Spell Hex settlement ${semanticAddressKey(selected.address)}`,
            );
            if (
              progress === undefined ||
              selectedOption === undefined ||
              progress.spellTraitKey !== selectedOption.traitKey ||
              progress.layoutKey !== selected.offer.hexTree.layoutKey
            )
              throw new CompilerError(
                'executionCoverageMissing',
                `Spell Hex evidence is incomplete for ${semanticAddressKey(selected.address)}`,
              );
            return Object.freeze({
              layoutKey: selected.offer.hexTree.layoutKey,
              rareTalentKeys: Object.freeze([...selected.offer.hexTree.rareTalentKeys]),
              epicTalentKeys: Object.freeze([...selected.offer.hexTree.epicTalentKeys]),
              ...(progress.godSent === undefined
                ? {}
                : {
                    godSent: Object.freeze({
                      olympianTalentKey: progress.godSent.olympianTalentKey,
                      lineageTalentKey: progress.godSent.lineageTalentKey,
                    }),
                  }),
            });
          })();
    return Object.freeze({
      kind: 'traits' as const,
      giver: selected.offer.giverKey,
      options: Object.freeze(
        selected.offer.options.map((option, index) => {
          const replacement = replacements[index];
          return Object.freeze({
            key: option.traitKey,
            ...(baseRarities[index] === undefined || baseRarities[index] === option.rarity
              ? {}
              : { baseRarity: baseRarities[index] }),
            ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
            ...(levels[index] === undefined ? {} : { effectiveLevel: levels[index] }),
            ...(option.allTogetherResult === undefined
              ? {}
              : {
                  allTogetherResult: Object.freeze({
                    earth: option.allTogetherResult.earth,
                    fire: option.allTogetherResult.fire,
                    air: option.allTogetherResult.air,
                    water: option.allTogetherResult.water,
                  }),
                }),
            ...(option.naturalSelectionTargets === undefined
              ? {}
              : { naturalSelectionTargets: Object.freeze([...option.naturalSelectionTargets]) }),
            ...(selectedTraitOffer.concaveStoneResult === undefined ||
            selectedTraitOffer.selectedOptionKey !== `option${index + 1}`
              ? {}
              : {
                  concaveStoneResult:
                    selectedTraitOffer.concaveStoneResult.kind === 'noProc'
                      ? Object.freeze({ kind: 'noProc' as const })
                      : Object.freeze({
                          kind: 'proc' as const,
                          optionKey: selectedTraitOffer.concaveStoneResult.optionKey,
                        }),
                }),
            ...(replacement === undefined
              ? {}
              : {
                  replacement: Object.freeze({
                    slot: replacement.slot,
                    replacedTraitKey: replacement.replacedTraitKey,
                    oldRarity: replacement.oldRarity,
                    newTraitKey: replacement.newTraitKey,
                    requiredRarity: replacement.requiredRarity,
                    ...(replacement.levelBonus === undefined
                      ? {}
                      : { levelBonus: replacement.levelBonus }),
                  }),
                }),
            ...(circeResolution === undefined || index !== selectedOptionIndex
              ? {}
              : { circeResolution }),
            ...(icarusHammerTarget === undefined || index !== selectedOptionIndex
              ? {}
              : { icarusHammerTarget }),
            ...(echoPomTarget === undefined || index !== selectedOptionIndex
              ? {}
              : { echoPomTarget }),
            ...(echoLastRunBoon === undefined || index !== selectedOptionIndex
              ? {}
              : {
                  echoLastRunBoon: Object.freeze({
                    options: Object.freeze(
                      echoLastRunBoon.options.map((nested) =>
                        Object.freeze({
                          giver: nested.giverKey,
                          key: nested.traitKey,
                          rarity: nested.rarity,
                          ...(nested.lootHistorySource === undefined
                            ? {}
                            : { lootHistorySource: nested.lootHistorySource }),
                          ...(nested.targetTraitKey === undefined
                            ? {}
                            : { targetTraitKey: nested.targetTraitKey }),
                          ...(nested.naturalSelectionTargets === undefined
                            ? {}
                            : {
                                naturalSelectionTargets: Object.freeze([
                                  ...nested.naturalSelectionTargets,
                                ]),
                              }),
                        }),
                      ),
                    ),
                    selected: echoLastRunBoon.selectedOptionKey,
                  }),
                }),
          });
        }),
      ),
      selected: selected.offer.selectedOptionKey,
      ...(selected.offer.rejectedOptionKey === undefined
        ? {}
        : { rejected: selected.offer.rejectedOptionKey }),
      ...(publishedHexTree === undefined ? {} : { hexTree: publishedHexTree }),
    });
  };
  const levelResolution = (
    source: TraitOfferOwnerAddress,
    role: string,
  ): ExecutionLevelResolution | undefined => {
    const matches = biome.rewards.selectedLevelResolutions.filter(
      (candidate) =>
        semanticAddressKey(candidate.address) ===
        semanticAddressKey(createLevelResolutionAddress(source, role)),
    );
    if (matches.length > 1)
      throw new CompilerError(
        'executionCoverageMissing',
        `duplicate level resolution ${semanticAddressKey(createLevelResolutionAddress(source, role))}`,
      );
    const selected = matches[0];
    if (selected === undefined) return undefined;
    const levelCount = agreement(
      selected.branches.map((branch) => branch.levelCount),
      `level count ${semanticAddressKey(selected.address)}`,
    );
    return Object.freeze({
      offeredTargets: Object.freeze(
        selected.value.kind === 'choice' ? [...selected.value.offeredTraitKeys] : [],
      ),
      selectedTarget:
        selected.value.kind === 'choice'
          ? selected.value.selectedTraitKey
          : selected.value.targetTraitKey,
      levelCount,
    });
  };
  const transactions: ExecutionTimelineTransaction[] = [];
  const activeRows = room.roomActionRoster.rows.filter((row) => !row.stale && row.rank !== null);
  const rowByOwner = new Map(
    activeRows.map((row) => [semanticAddressKey(row.owner), row] as const),
  );
  const windowFor = (transactionOwner: string): import('../model').ExecutionLifecycleWindow => {
    const row = rowByOwner.get(transactionOwner);
    if (row === undefined)
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} has a transaction without an active roster owner ${transactionOwner}`,
      );
    return assembleLifecycleWindow(row.window);
  };
  const add = (transaction: ExecutionTimelineTransaction): void => {
    if (transactions.some((candidate) => candidate.owner === transaction.owner))
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} repeats execution transaction owner ${transaction.owner}`,
      );
    transactions.push(Object.freeze(transaction));
  };
  const replayOwnerAddress = createEchoKeepsakeReplayAddress(
    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
  );
  const replayOwner = semanticAddressKey(replayOwnerAddress);
  const replayNode = timelineFacts.nodes.find(
    (node) => semanticAddressKey(node.owner) === replayOwner,
  );
  if (
    room.occurrenceId === biome.snapshot.entryRoom.occurrenceId &&
    replayNode?.included === true
  ) {
    const replay = biome.rewards.volatileEchoKeepsakeReplay;
    if (replay === undefined)
      throw new CompilerError(
        'executionCoverageMissing',
        `missing exact Echo keepsake replay result ${replayOwner}`,
      );
    const equipResults =
      replay.result.kind === 'experimentalHammer'
        ? Object.freeze({ experimentalHammer: Object.freeze({ ...replay.result.value }) })
        : Object.freeze({
            transcendentEmbryo: Object.freeze({
              blessingKey: replay.result.value.blessingKey,
              blessingValues: Object.freeze({ ...replay.result.value.blessingValues }),
            }),
          });
    add({
      kind: 'keepsakeReplay',
      owner: replayOwner,
      window: Object.freeze({ kind: 'standard', phase: 'beforeCombat' }),
      keepsakeKey: replay.capturedKeepsakeKey,
      equipResults,
    });
  }
  const timeline = appendTranscendentEmbryoTimelineEffects(
    appendSteadyGrowthTimelineEffects(
      room.roomLifecycleTimeline,
      biome.rewards.steadyGrowthOutcomes.map((outcome) => outcome.address),
    ),
    biome.rewards.transcendentEmbryoOutcomes.map((outcome) => outcome.address),
  );
  for (const timelineEntry of timeline.entries) {
    const timeline = timelineEntry;
    if (timeline.kind === 'boundary') {
      const boundary = timeline.boundary;
      if (boundary.kind === 'roomEntered') continue;
      if (boundary.kind === 'encounterStart') {
        const phase = room.encounterPhases.find(
          (candidate) => candidate.slotKey === boundary.phaseKey,
        );
        if (phase === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `${room.gameName} lacks encounter phase ${boundary.phaseKey}`,
          );
        // Encounter boundaries are lifecycle checkpoints, not transactions.
      }
      continue;
    }
    if (timeline.kind === 'automaticEffect') {
      if (timeline.effect === 'steadyGrowth') {
        const outcome = biome.rewards.steadyGrowthOutcomes.find(
          (candidate) =>
            semanticAddressKey(candidate.address) === semanticAddressKey(timeline.address),
        );
        if (outcome === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `missing automatic outcome ${semanticAddressKey(timeline.address)}`,
          );
        const selected = room.encounters.steadyGrowthTargetByPhase?.[timeline.phaseKey];
        if (selected === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `missing Steady Growth target ${timeline.phaseKey}`,
          );
        add({
          kind: 'automatic',
          owner: semanticAddressKey(timeline.address),
          effect: 'steadyGrowth',
          phaseKey: timeline.phaseKey,
          source: outcome.sourceTraitKey,
          target: selected,
          window: Object.freeze({ kind: 'encounterEnd', phaseKey: timeline.phaseKey }),
        });
      } else {
        const outcome = biome.rewards.transcendentEmbryoOutcomes.find(
          (candidate) =>
            semanticAddressKey(candidate.address) === semanticAddressKey(timeline.address),
        );
        if (outcome === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `missing automatic outcome ${semanticAddressKey(timeline.address)}`,
          );
        const selected = room.encounters.transcendentEmbryoBlessingByPhase?.[timeline.phaseKey];
        const rarities = outcome.transformationRarities;
        if (selected === undefined || rarities.length !== 1)
          throw new CompilerError(
            'executionCoverageMissing',
            `missing or divergent Embryo outcome ${timeline.phaseKey}`,
          );
        add({
          kind: 'automatic',
          owner: semanticAddressKey(timeline.address),
          effect: 'transcendentEmbryo',
          phaseKey: timeline.phaseKey,
          source: outcome.sourceBlessingKey,
          target: selected.blessingKey,
          rarity: rarities[0]!,
          blessingValues: selected.blessingValues,
          window: Object.freeze({ kind: 'encounterEnd', phaseKey: timeline.phaseKey }),
        });
      }
      continue;
    }
    const actionNode = timelineFacts.nodes.find(
      (node) => semanticAddressKey(node.owner) === semanticAddressKey(timeline.action.owner),
    );
    // The planner's Timeline fact is the publication authority. Optional rows
    // that were never authored have no active included node and never become
    // executor transactions.
    if (actionNode?.included !== true) continue;
    if (
      timeline.action.reference.kind === 'interactEncounter' ||
      timeline.action.reference.kind === 'interactGorgon'
    ) {
      const phaseKey = timeline.phaseKey ?? timeline.action.reference.phaseKey;
      const encounterKey = room.encounters.encounterKeyByPhase[phaseKey];
      const phase = createEncounterPhaseAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        { kind: 'occurrence', occurrenceId: room.occurrenceId },
        phaseKey,
      );
      // Encounter-owned screens (Narcissus, Artemis and Gorgon) are authored
      // on the phase's selection role. `self` belongs to an acquisition role;
      // consulting it here silently omitted an otherwise complete NPC screen.
      // Some story interactions have no entry in the encounter-key map even
      // though their timeline phase owns a fully resolved selection screen.
      // The selection address itself is the authoritative join key.
      const selectedOffer = traitOffer(phase, 'selection');
      const nemesis = room.encounters.nemesisRandomEventByPhase?.[phaseKey];
      if (encounterKey === 'NemesisRandomEvent' && nemesis === null)
        throw new CompilerError(
          'executionCoverageMissing',
          `unresolved Nemesis event ${owner}:${phaseKey}`,
        );
      const nemesisFreeItem =
        nemesis?.kind === 'freeItem'
          ? room.acquisitionSites[nemesisGeneratedPickupSiteKey(phaseKey)]?.entries.result
          : undefined;
      if (
        nemesis?.kind === 'freeItem' &&
        (nemesisFreeItem === undefined || nemesisFreeItem === null)
      )
        throw new CompilerError(
          'executionCoverageMissing',
          `missing Nemesis free-item result ${owner}:${phaseKey}`,
        );
      add({
        kind: 'encounterInteraction',
        owner: semanticAddressKey(timeline.action.owner),
        phaseKey,
        ...(selectedOffer === undefined
          ? {}
          : { resolution: Object.freeze({ kind: 'traitOffer' as const, offer: selectedOffer }) }),
        ...(nemesis === undefined || nemesis === null
          ? {}
          : {
              resolution: Object.freeze({
                kind: 'nemesisRandomEvent' as const,
                outcome:
                  nemesis.kind === 'freeItem'
                    ? Object.freeze({
                        kind: 'freeItem' as const,
                        itemGameName: nemesisFreeItem!.offer.rewardType,
                      })
                    : nemesis,
              }),
            }),
        window: windowFor(semanticAddressKey(timeline.action.owner)),
      });
      continue;
    }
    if (timeline.action.reference.kind === 'collectRequiredReward') continue;
    if (
      timeline.action.reference.kind !== 'interactIncomingReward' &&
      timeline.action.reference.kind !== 'interactLocalReward' &&
      timeline.action.reference.kind !== 'interactAcquisitionEntry' &&
      timeline.action.reference.kind !== 'interactShopOffer' &&
      timeline.action.reference.kind !== 'purchaseStygianWellOffer'
    ) {
      const reference = timeline.action.reference;
      if (reference.kind === 'sellPurgingPoolTrait') {
        const traitKey = room.purgingPool?.traitKeyBySlot[reference.slotKey];
        if (traitKey === null || traitKey === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `${room.gameName} lacks selected Pool sale ${reference.slotKey}`,
          );
        add({
          kind: 'poolSale',
          owner: semanticAddressKey(timeline.action.owner),
          slotKey: reference.slotKey,
          traitKey,
          window: windowFor(semanticAddressKey(timeline.action.owner)),
        });
      } else if (reference.kind === 'interactKeepsakeRack') {
        const keepsakeKey = room.keepsakeRack?.keepsakeKey;
        if (keepsakeKey === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `${room.gameName} lacks selected keepsake rack target`,
          );
        const rackOwner = semanticAddressKey(timeline.action.owner);
        const equipResults = executionKeepsakeEquipResults(room.keepsakeRack?.equipResults);
        add({
          kind: 'keepsakeChange',
          owner: rackOwner,
          keepsakeKey,
          ...(equipResults === undefined ? {} : { equipResults }),
          window: windowFor(rackOwner),
        });
      } else if (reference.kind === 'useFountain') {
        const fountainOwner = semanticAddressKey(timeline.action.owner);
        add({
          kind: 'fountainUse',
          owner: fountainOwner,
          interactionKey: 'fountain',
          ...(room.fountainRarityResult === undefined
            ? {}
            : { aromaticPhialTarget: room.fountainRarityResult.targetTraitKey }),
          window: windowFor(fountainOwner),
        });
      } else {
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} has an unsupported active Room Action ${reference.kind}`,
        );
      }
      continue;
    }
    if (timeline.action.reference.kind === 'purchaseStygianWellOffer') {
      const generationKey = timeline.action.reference.generationKey;
      const slot =
        generationKey === 'travelDealRefill'
          ? undefined
          : (generationKey.slice('initial:'.length) as 'healing' | 'secondLeft' | 'secondRight');
      const offerKey =
        generationKey === 'travelDealRefill'
          ? room.stygianWell?.travelDealRefillKey
          : room.stygianWell?.offerKeyBySlot[slot!];
      if (offerKey === undefined || offerKey === null)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks Well inventory for ${generationKey}`,
        );
      const effect = room.stygianWellOfferEffects?.[generationKey];
      if (effect === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks normalized Well effect for ${generationKey}`,
        );
      const extendedDirectPurchase =
        room.stygianWellExtendedDirectPurchaseItemKeys?.includes(offerKey) === true;
      const twistResultKey =
        room.stygianWell?.twistResultKeyBySlot?.[
          generationKey === 'travelDealRefill' ? 'travelDealRefill' : slot!
        ];
      const wellOwner = semanticAddressKey(timeline.action.owner);
      add({
        kind: 'wellPurchase',
        owner: wellOwner,
        generationKey,
        offerKey,
        effect,
        extendedDirectPurchase,
        ...(twistResultKey === undefined || twistResultKey === null ? {} : { twistResultKey }),
        window: windowFor(wellOwner),
      });
      continue;
    }
    const actionReference = timeline.action.reference;
    const shopOffer =
      actionReference.kind === 'interactShopOffer'
        ? room.entryState?.offers.find(
            (candidate) => candidate.offerKey === actionReference.offerKey,
          )
        : undefined;
    if (actionReference.kind === 'interactShopOffer' && shopOffer === undefined)
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} lacks World Shop offer ${actionReference.offerKey}`,
      );
    const source =
      actionReference.kind === 'interactShopOffer'
        ? createShopOfferAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            room.occurrenceId,
            actionReference.offerKey,
          )
        : sourceForAction(timeline.action.owner);
    if (
      source.kind !== 'incomingReward' &&
      source.kind !== 'localReward' &&
      source.kind !== 'rewardWheelOffer' &&
      source.kind !== 'shopOffer' &&
      source.kind !== 'encounterPhase' &&
      source.kind !== 'gorgonPhase' &&
      source.kind !== 'acquisitionEntry'
    ) {
      throw new CompilerError(
        'executionCoverageMissing',
        `unmapped acquisition owner ${semanticAddressKey(source)}`,
      );
    }
    const branchRows = biome.rewards.branches.map((branch) => {
      const authoredRole =
        timeline.action.owner.kind === 'acquisitionRole'
          ? timeline.action.owner.acquisitionRole
          : undefined;
      const events = branch.events.filter(
        (
          candidate,
        ): candidate is Extract<
          RewardEvent,
          | { readonly kind: 'concreteAcquisition' }
          | { readonly kind: 'conversionToGold' }
          | { readonly kind: 'artificerConversion' }
        > =>
          (candidate.kind === 'concreteAcquisition' ||
            candidate.kind === 'conversionToGold' ||
            candidate.kind === 'artificerConversion') &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(source) &&
          (authoredRole === undefined || candidate.acquisition.role === authoredRole),
      );
      if (events.length === 0)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} is missing acquisition ${semanticAddressKey(source)}`,
        );
      return Object.freeze({ branch, events: Object.freeze(events) });
    });
    const row = agreement(
      branchRows.map((candidate) => candidate.events),
      `acquisition ${semanticAddressKey(source)}`,
    );
    // A Time Piece conversion is a planner-side destruction event, not an
    // execution acquisition.  Artificer still needs the expected native
    // replacement to steer its source contact when that replacement child
    // was itself Time-Pieced, so retain that narrow proof on the source role.
    const publishedEvents = row.filter((event) => event.kind !== 'conversionToGold');
    if (publishedEvents.length === 0) continue;
    const acquisitionSource = agreement(
      publishedEvents.map((event) => event.source),
      `acquisition source ${semanticAddressKey(source)}`,
    );
    const roles: readonly ExecutionAcquisitionRole[] = Object.freeze(
      publishedEvents.map((event) => {
        const role = event.acquisition.role;
        const offer = traitOffer(source, role);
        const level = levelResolution(source, role);
        const replacement =
          event.kind === 'artificerConversion'
            ? (() => {
                const materializations = branchRows.map(({ branch }) => {
                  const consumedChildren = branch.events.filter(
                    (
                      candidate,
                    ): candidate is Extract<RewardEvent, { readonly kind: 'conversionToGold' }> =>
                      candidate.kind === 'conversionToGold' &&
                      candidate.source.producer?.kind === 'artificerReplacement' &&
                      semanticAddressKey(candidate.source.producer.sourceOwner) ===
                        semanticAddressKey(event.origin) &&
                      candidate.source.producer.sourceRole === role,
                  );
                  if (consumedChildren.length > 1)
                    throw new CompilerError(
                      'executionCoverageMissing',
                      `ambiguous Time Piece Artificer materialization ${semanticAddressKey(event.origin)} ${role}`,
                    );
                  const child = consumedChildren[0];
                  if (child === undefined) return undefined;
                  return Object.freeze({
                    reward: executionRewardFromOffer(
                      event.replacement,
                      'RoomReward',
                      'RunProgress',
                    ),
                    gameName: child.acquisition.acquisition.gameName,
                  });
                });
                if (materializations.every((candidate) => candidate === undefined))
                  return undefined;
                if (materializations.some((candidate) => candidate === undefined))
                  throw new CompilerError(
                    'executionCoverageMissing',
                    `divergent Time Piece Artificer materialization ${semanticAddressKey(event.origin)} ${role}`,
                  );
                return agreement(
                  materializations as readonly NonNullable<(typeof materializations)[number]>[],
                  `Artificer materialization ${semanticAddressKey(event.origin)} ${role}`,
                );
              })()
            : undefined;
        return Object.freeze({
          role,
          disposition:
            event.kind === 'artificerConversion' ? ('artificer' as const) : ('normal' as const),
          ...(event.source.producer === undefined
            ? {}
            : {
                producer: Object.freeze({
                  kind: event.source.producer.kind,
                  sourceOwner: semanticAddressKey(event.source.producer.sourceOwner),
                  sourceRole: event.source.producer.sourceRole,
                }),
              }),
          lifecyclePoint: event.acquisition.lifecyclePoint,
          kind: event.acquisition.acquisition.kind,
          gameName: event.acquisition.acquisition.gameName,
          ...(event.kind !== 'concreteAcquisition' || event.seaStarResult === undefined
            ? {}
            : { seaStarResult: event.seaStarResult }),
          ...(replacement === undefined ? {} : { replacement }),
          ...(event.settlement === undefined
            ? {}
            : {
                settlement: Object.freeze({
                  site: semanticAddressKey(event.settlement.site),
                  entry: semanticAddressKey(event.settlement.entry),
                }),
              }),
          ...(offer === undefined ? {} : { traitOffer: offer }),
          ...(level === undefined ? {} : { levelResolution: level }),
        });
      }),
    );
    const reward = executionRewardFromOffer(
      acquisitionSource.offer,
      acquisitionSource.producerLifecycleKey,
      acquisitionSource.resolvedStoreKey,
    );
    const acquisitionOwner = semanticAddressKey(timeline.action.owner);
    if (shopOffer !== undefined) {
      add({
        kind: 'shopPurchase',
        owner: acquisitionOwner,
        sourceOwner: semanticAddressKey(source),
        reward,
        producerLifecycleKey: acquisitionSource.producerLifecycleKey,
        roles,
        offerKey: shopOffer.offerKey,
        rewardType: shopOffer.offer.rewardType,
        window: windowFor(acquisitionOwner),
      });
    } else {
      add({
        kind: 'acquisition',
        owner: acquisitionOwner,
        sourceOwner: semanticAddressKey(source),
        reward,
        producerLifecycleKey: acquisitionSource.producerLifecycleKey,
        roles,
        window: windowFor(acquisitionOwner),
      });
    }
  }
  for (const refill of biome.rewards.wellRefillRealizations) {
    if (
      !('occurrenceId' in refill.owner) ||
      refill.owner.occurrenceId !== room.occurrenceId ||
      refill.owner.biomeKey !== room.origin.biomeKey ||
      refill.owner.routeKey !== room.origin.routeKey
    )
      continue;
    add({
      kind: 'wellRefill',
      owner: semanticAddressKey(refill.owner),
      generationKey: 'travelDealRefill',
      offerKey: refill.offerKey,
      effect: refill.effect,
      ...(refill.twistResultKey === undefined ? {} : { twistResultKey: refill.twistResultKey }),
      window: windowFor(semanticAddressKey(refill.sourceOwner)),
    });
  }
  for (const outcome of biome.rewards.bossArcanaOutcomes) {
    if (
      !('occurrenceId' in outcome.owner) ||
      outcome.owner.occurrenceId !== room.occurrenceId ||
      outcome.owner.biomeKey !== room.origin.biomeKey ||
      outcome.owner.routeKey !== room.origin.routeKey
    )
      continue;
    add({
      kind: 'automatic',
      owner: semanticAddressKey(outcome.owner),
      effect: outcome.effect,
      phaseKey: outcome.phaseKey,
      arcanaKeys: Object.freeze([...outcome.arcanaKeys]),
      rarity: outcome.rarity,
      window: Object.freeze({ kind: 'bossDefeated', phaseKey: outcome.phaseKey }),
    });
  }
  return Object.freeze(transactions);
}
