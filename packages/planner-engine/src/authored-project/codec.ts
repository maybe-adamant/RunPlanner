import type { Catalog, RouteDeclaration } from '../catalog-schema';
import { decodeBiomeState } from './biomeState';
import { assessStartingArcanaGrasp } from './loadout';
import { decodeBiomeTopology } from './topology/codec';
import { decodeAcquisitionSites } from './topology/acquisition-site-codec';
import { decodeRoomActionState } from './topology/room-action-codec';
import {
  assertStygianWellPurchaseActionClosure,
  decodeStygianWellState,
} from './topology/well-codec';
import { selectedPickupProducers } from './pickup-producers';
import { createBiomeAddress } from './addresses';
import { decodeRoomEncounterState } from './room-state/encounters';
import { decodeNullableRewardState } from './room-state/codec';
import { completionOccurrenceId } from './completion-occurrences';
import { roomActionKey } from './room-actions';
import { assembleRoomActionDomain, type RoomActionContribution } from './room-action-domain';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type AuthoredBiomePlan,
  type AuthoredKeepsakeEquipResults,
  type AuthoredRoutePlan,
  type ProjectDocument,
} from './model';
import {
  expectArray,
  expectBoolean,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument as fail,
} from './validation';

function decodeHermesShrineState(
  value: unknown,
  path: string,
  catalog: Catalog,
): import('./model').HermesShrineState {
  const raw = expectRecord(value, path);
  expectExactKeys(
    raw,
    [
      'offerBySlot',
      ...(raw.purchaseBySlot === undefined ? [] : ['purchaseBySlot']),
      ...(raw.travelDealRefill === undefined ? [] : ['travelDealRefill']),
    ],
    path,
  );
  const offers = expectRecord(raw.offerBySlot, `${path}.offerBySlot`);
  const slots = ['first', 'secondLeft', 'secondRight'] as const;
  expectExactKeys(offers, slots, `${path}.offerBySlot`);
  const offerBySlot = Object.freeze(
    Object.fromEntries(
      slots.map((slot) => [
        slot,
        decodeNullableRewardState(offers[slot], catalog, `${path}.offerBySlot.${slot}`, {
          kind: 'producerLifecycle',
          key: 'HermesShrineDelivery',
        }),
      ]),
    ) as Record<
      import('./model').HermesShrineSlotKey,
      import('./model').AuthoredRewardState | null
    >,
  );
  const decodePurchase = (value: unknown, purchasePath: string) => {
    const purchase = expectRecord(value, purchasePath);
    expectExactKeys(purchase, ['delay', 'rushed'], purchasePath);
    const delay = purchase.delay;
    if (![2, 3, 4, 5, 6, 7, 8].includes(delay as number))
      fail(`${purchasePath}.delay`, 'must be an integer from 2 through 8');
    return Object.freeze({
      delay: delay as 2 | 3 | 4 | 5 | 6 | 7 | 8,
      rushed: expectBoolean(purchase.rushed, `${purchasePath}.rushed`),
    });
  };
  const purchases =
    raw.purchaseBySlot === undefined
      ? undefined
      : expectRecord(raw.purchaseBySlot, `${path}.purchaseBySlot`);
  for (const key of Object.keys(purchases ?? {}))
    if (!slots.includes(key as (typeof slots)[number]))
      fail(`${path}.purchaseBySlot.${key}`, 'is not a declared Shrine slot');
  const purchaseBySlot = Object.freeze(
    Object.fromEntries(
      Object.entries(purchases ?? {}).map(([slot, rawPurchase]) => {
        return [slot, decodePurchase(rawPurchase, `${path}.purchaseBySlot.${slot}`)];
      }),
    ) as Partial<
      Record<
        import('./model').HermesShrineSlotKey,
        { readonly delay: 2 | 3 | 4 | 5 | 6 | 7 | 8; readonly rushed: boolean }
      >
    >,
  );
  for (const slot of Object.keys(purchaseBySlot) as import('./model').HermesShrineSlotKey[]) {
    if (offerBySlot[slot] === null)
      fail(`${path}.purchaseBySlot.${slot}`, 'requires a resolved source offer');
  }
  const refill =
    raw.travelDealRefill === undefined
      ? undefined
      : (() => {
          const refillRaw = expectRecord(raw.travelDealRefill, `${path}.travelDealRefill`);
          expectExactKeys(
            refillRaw,
            ['offer', ...(refillRaw.purchase === undefined ? [] : ['purchase'])],
            `${path}.travelDealRefill`,
          );
          const purchase =
            refillRaw.purchase === undefined
              ? undefined
              : decodePurchase(refillRaw.purchase, `${path}.travelDealRefill.purchase`);
          if (purchase?.rushed === true)
            fail(`${path}.travelDealRefill.purchase.rushed`, 'must be false');
          const offer = decodeNullableRewardState(
            refillRaw.offer,
            catalog,
            `${path}.travelDealRefill.offer`,
            { kind: 'producerLifecycle', key: 'HermesShrineDelivery' },
          );
          if (purchase !== undefined && offer === null)
            fail(`${path}.travelDealRefill.purchase`, 'requires a resolved source offer');
          return Object.freeze({
            offer,
            ...(purchase === undefined ? {} : { purchase }),
          });
        })();
  return Object.freeze({
    offerBySlot,
    ...(purchases === undefined || Object.keys(purchaseBySlot).length === 0
      ? {}
      : { purchaseBySlot }),
    ...(refill === undefined ? {} : { travelDealRefill: refill }),
  });
}

function assertHermesShrinePurchaseActionClosure(
  shrine: import('./model').HermesShrineState | undefined,
  roomActions: import('./model').RoomActionState,
  path: string,
): void {
  const purchases = new Set<import('./model').HermesShrineGenerationKey>([
    ...Object.keys(shrine?.purchaseBySlot ?? {}).map(
      (slotKey) => `initial:${slotKey}` as import('./model').HermesShrineGenerationKey,
    ),
    ...(shrine?.travelDealRefill?.purchase === undefined ? [] : ['travelDealRefill' as const]),
  ]);
  const actions = new Set(
    roomActions.order.flatMap((reference) =>
      reference.kind === 'purchaseHermesShrineOffer' ? [reference.generationKey] : [],
    ),
  );
  if (purchases.size !== actions.size || [...purchases].some((key) => !actions.has(key)))
    fail(path, 'Shrine purchase details must have exactly one matching purchase action');
}

function decodeKeepsakeEquipResults(
  value: unknown,
  path: string,
  catalog: Catalog,
): AuthoredKeepsakeEquipResults {
  const results = expectRecord(value, path);
  expectExactKeys(results, ['jeweledPom', 'experimentalHammer'], path);
  if (results.jeweledPom === undefined && results.experimentalHammer === undefined)
    return Object.freeze({});
  const hammer =
    results.experimentalHammer === undefined
      ? undefined
      : expectRecord(results.experimentalHammer, `${path}.experimentalHammer`);
  if (hammer !== undefined) {
    const kind = expectString(hammer.kind, `${path}.experimentalHammer.kind`);
    if (kind === 'selected') {
      expectExactKeys(hammer, ['kind', 'traitKey'], `${path}.experimentalHammer`);
      const traitKey = expectString(hammer.traitKey, `${path}.experimentalHammer.traitKey`);
      if (catalog.traits.byKey[traitKey]?.hammerCompatibility === undefined)
        fail(`${path}.experimentalHammer.traitKey`, 'must be a declared Hammer trait');
    } else if (kind === 'exhausted') {
      expectExactKeys(hammer, ['kind'], `${path}.experimentalHammer`);
    } else fail(`${path}.experimentalHammer.kind`, 'must be selected or exhausted');
  }
  if (results.jeweledPom === undefined) {
    if (hammer === undefined) return Object.freeze({});
    return Object.freeze({
      experimentalHammer: Object.freeze({
        ...(hammer.kind === 'selected'
          ? { kind: 'selected' as const, traitKey: hammer.traitKey as string }
          : { kind: 'exhausted' as const }),
      }),
    });
  }
  const pom = expectRecord(results.jeweledPom, `${path}.jeweledPom`);
  expectExactKeys(pom, ['traitKey', 'rarity'], `${path}.jeweledPom`);
  const traitKey = expectString(pom.traitKey, `${path}.jeweledPom.traitKey`);
  const descriptor = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'jeweledPom',
  )?.effect;
  if (descriptor === undefined || descriptor.kind !== 'jeweledPom')
    fail(`${path}.jeweledPom`, 'has no declared Jeweled Pom descriptor');
  if (!catalog.traitGivers.byKey[descriptor.giverKey]?.traitKeys.includes(traitKey))
    fail(
      `${path}.jeweledPom.traitKey`,
      `must be a ${descriptor.giverKey} trait, received ${traitKey}`,
    );
  const trait = catalog.traits.byKey[traitKey];
  const rarityPolicy = catalog.traitGivers.byKey[descriptor.giverKey]?.rarityPolicy;
  let rarity: import('../catalog-schema').TraitRarity | undefined;
  if (trait?.rarityDomain.kind === 'none') {
    if (rarityPolicy?.kind !== 'none')
      fail(`${path}.jeweledPom`, `${descriptor.giverKey} has inconsistent rarity declarations`);
    if (pom.rarity !== undefined)
      fail(`${path}.jeweledPom.rarity`, `rarityless trait ${traitKey} has no rarity`);
  } else {
    const authoredRarity = expectString(pom.rarity, `${path}.jeweledPom.rarity`);
    if (rarityPolicy?.kind !== 'fixed' || authoredRarity !== rarityPolicy.rarity)
      fail(`${path}.jeweledPom.rarity`, `must equal ${descriptor.giverKey}'s fixed result rarity`);
    if (
      !trait?.rarityDomain.freshOfferRarities.includes(
        authoredRarity as import('../catalog-schema').TraitRarity,
      )
    )
      fail(`${path}.jeweledPom.rarity`, `is not declared for ${traitKey}`);
    rarity = authoredRarity as import('../catalog-schema').TraitRarity;
  }
  return Object.freeze({
    jeweledPom: Object.freeze({
      traitKey,
      ...(rarity === undefined ? {} : { rarity }),
    }),
    ...(hammer === undefined
      ? {}
      : {
          experimentalHammer: Object.freeze(
            hammer.kind === 'selected'
              ? { kind: 'selected' as const, traitKey: hammer.traitKey as string }
              : { kind: 'exhausted' as const },
          ),
        }),
  });
}

export { ProjectDocumentContractError } from './validation';

function decodeBiomePlan(
  value: unknown,
  path: string,
  routeKey: string,
  expectedBiomeKey: string,
  catalog: Catalog,
): AuthoredBiomePlan {
  const plan = expectRecord(value, path);

  const layout = catalog.biomeLayouts.byKey[expectedBiomeKey];
  if (layout === undefined) {
    fail(path, `catalog has no authored layout for ${expectedBiomeKey}`);
  }

  const biomeKey = expectString(plan.biomeKey, `${path}.biomeKey`);
  if (biomeKey !== expectedBiomeKey) {
    fail(`${path}.biomeKey`, `expected contiguous biome ${expectedBiomeKey}`);
  }

  // This dormant child is optional in the authored model. Encoding can omit
  // it, so decoding must accept that exact persisted representation too.
  expectExactKeys(
    plan,
    ['biomeKey', 'state', 'topology', 'completionOccurrences', 'echoKeepsakeReplayResults'],
    path,
  );
  const rawCompletion = expectArray(plan.completionOccurrences, `${path}.completionOccurrences`);
  if (rawCompletion.length !== layout.completion.rooms.length)
    fail(`${path}.completionOccurrences`, 'must contain every declared automatic completion room');
  const completionOccurrences = Object.freeze(
    layout.completion.rooms.map((descriptor, index) => {
      const raw = expectRecord(rawCompletion[index], `${path}.completionOccurrences[${index}]`);
      const room = catalog.rooms.byKey[descriptor.roomGameName];
      if (
        room === undefined ||
        room.mode.kind !== 'automatic' ||
        room.mode.role !== descriptor.role
      )
        fail(
          `${path}.completionOccurrences[${index}]`,
          'does not match automatic completion declaration',
        );
      expectExactKeys(
        raw,
        [
          'occurrenceId',
          'gameName',
          'state',
          'encounters',
          'roomActions',
          'additionalExits',
          ...(raw.acquisitionSites === undefined ? [] : ['acquisitionSites']),
          ...(room.hasKeepsakeRack ? ['keepsakeRack'] : []),
          ...(room.purgingPool !== undefined ? ['purgingPool'] : []),
          ...(room.surfaceShop?.forced === true ? ['hermesShrine'] : []),
          ...(room.roomShop?.forced === true ? ['stygianWell'] : []),
        ],
        `${path}.completionOccurrences[${index}]`,
      );
      if (
        expectString(raw.occurrenceId, `${path}.completionOccurrences[${index}].occurrenceId`) !==
        completionOccurrenceId(biomeKey, descriptor.role)
      )
        fail(
          `${path}.completionOccurrences[${index}].occurrenceId`,
          'must use its fixed completion occurrence id',
        );
      if (
        expectString(raw.gameName, `${path}.completionOccurrences[${index}].gameName`) !==
        room.gameName
      )
        fail(`${path}.completionOccurrences[${index}].gameName`, `must equal ${room.gameName}`);
      const state = expectRecord(raw.state, `${path}.completionOccurrences[${index}].state`);
      expectExactKeys(state, ['kind'], `${path}.completionOccurrences[${index}].state`);
      if (state.kind !== 'none')
        fail(`${path}.completionOccurrences[${index}].state.kind`, 'must be none');
      const encounters = decodeRoomEncounterState(
        raw.encounters,
        catalog,
        room,
        `${path}.completionOccurrences[${index}].encounters`,
      );
      const roomActions = decodeRoomActionState(
        raw.roomActions,
        `${path}.completionOccurrences[${index}].roomActions`,
      );
      const purgingPool =
        room.purgingPool === undefined
          ? undefined
          : (() => {
              const value = expectRecord(
                raw.purgingPool,
                `${path}.completionOccurrences[${index}].purgingPool`,
              );
              expectExactKeys(
                value,
                ['interacted', 'traitKeyBySlot'],
                `${path}.completionOccurrences[${index}].purgingPool`,
              );
              const interacted = expectBoolean(
                value.interacted,
                `${path}.completionOccurrences[${index}].purgingPool.interacted`,
              );
              const traitKeys = expectRecord(
                value.traitKeyBySlot,
                `${path}.completionOccurrences[${index}].purgingPool.traitKeyBySlot`,
              );
              expectExactKeys(
                traitKeys,
                [...room.purgingPool.slotKeys],
                `${path}.completionOccurrences[${index}].purgingPool.traitKeyBySlot`,
              );
              const decoded = Object.fromEntries(
                room.purgingPool.slotKeys.map((slot) => {
                  const entry = traitKeys[slot];
                  if (entry === null) return [slot, null];
                  const traitKey = expectString(
                    entry,
                    `${path}.completionOccurrences[${index}].purgingPool.traitKeyBySlot.${slot}`,
                  );
                  if (catalog.traits.byKey[traitKey] === undefined)
                    fail(
                      `${path}.completionOccurrences[${index}].purgingPool.traitKeyBySlot.${slot}`,
                      'unknown trait',
                    );
                  return [slot, traitKey];
                }),
              );
              return Object.freeze({
                interacted,
                traitKeyBySlot: Object.freeze(decoded) as Readonly<
                  Record<'left' | 'middle' | 'right', string | null>
                >,
              });
            })();
      const hermesShrine =
        room.surfaceShop?.forced !== true
          ? undefined
          : decodeHermesShrineState(
              raw.hermesShrine,
              `${path}.completionOccurrences[${index}].hermesShrine`,
              catalog,
            );
      const stygianWell =
        room.roomShop?.forced !== true
          ? undefined
          : decodeStygianWellState(
              raw.stygianWell,
              `${path}.completionOccurrences[${index}].stygianWell`,
              catalog,
            );
      assertHermesShrinePurchaseActionClosure(
        hermesShrine,
        roomActions,
        `${path}.completionOccurrences[${index}].roomActions.order`,
      );
      assertStygianWellPurchaseActionClosure(
        stygianWell,
        roomActions,
        `${path}.completionOccurrences[${index}].roomActions.order`,
      );
      if (!Array.isArray(raw.additionalExits) || raw.additionalExits.length !== 0)
        fail(`${path}.completionOccurrences[${index}].additionalExits`, 'must be empty');
      const keepsakeRack = !room.hasKeepsakeRack
        ? undefined
        : (() => {
            const value = expectRecord(
              raw.keepsakeRack,
              `${path}.completionOccurrences[${index}].keepsakeRack`,
            );
            expectExactKeys(
              value,
              ['disposition', ...(value.equipResults === undefined ? [] : ['equipResults'])],
              `${path}.completionOccurrences[${index}].keepsakeRack`,
            );
            const disposition = expectRecord(
              value.disposition,
              `${path}.completionOccurrences[${index}].keepsakeRack.disposition`,
            );
            const kind = expectString(
              disposition.kind,
              `${path}.completionOccurrences[${index}].keepsakeRack.disposition.kind`,
            );
            if (kind === 'retain')
              expectExactKeys(
                disposition,
                ['kind'],
                `${path}.completionOccurrences[${index}].keepsakeRack.disposition`,
              );
            else if (kind === 'replace') {
              expectExactKeys(
                disposition,
                ['kind', 'keepsakeKey'],
                `${path}.completionOccurrences[${index}].keepsakeRack.disposition`,
              );
              if (
                catalog.keepsakes.byKey[
                  expectString(
                    disposition.keepsakeKey,
                    `${path}.completionOccurrences[${index}].keepsakeRack.disposition.keepsakeKey`,
                  )
                ] === undefined
              )
                fail(
                  `${path}.completionOccurrences[${index}].keepsakeRack.disposition.keepsakeKey`,
                  'unknown keepsake',
                );
            } else
              fail(
                `${path}.completionOccurrences[${index}].keepsakeRack.disposition.kind`,
                'must be retain or replace',
              );
            return Object.freeze({
              disposition:
                kind === 'retain'
                  ? Object.freeze({ kind: 'retain' as const })
                  : Object.freeze({
                      kind: 'replace' as const,
                      keepsakeKey: disposition.keepsakeKey as string,
                    }),
              ...(value.equipResults === undefined
                ? {}
                : {
                    equipResults: decodeKeepsakeEquipResults(
                      value.equipResults,
                      `${path}.completionOccurrences[${index}].keepsakeRack.equipResults`,
                      catalog,
                    ),
                  }),
            });
          })();
      const occurrenceBase = Object.freeze({
        occurrenceId: completionOccurrenceId(biomeKey, descriptor.role),
        gameName: room.gameName,
        state: Object.freeze({ kind: 'none' as const }),
        encounters,
        roomActions,
        ...(purgingPool === undefined ? {} : { purgingPool }),
        ...(hermesShrine === undefined ? {} : { hermesShrine }),
        ...(stygianWell === undefined ? {} : { stygianWell }),
        additionalExits: Object.freeze([]),
      });
      const acquisitionSites =
        raw.acquisitionSites === undefined
          ? undefined
          : decodeAcquisitionSites(
              raw.acquisitionSites,
              Object.freeze({
                occurrenceId: occurrenceBase.occurrenceId,
                gameName: room.gameName,
                anomalyReplacement: undefined,
                hasAnomalyReplacement: false,
                state: raw.state,
                encounters: raw.encounters,
                roomActions: raw.roomActions,
                additionalExits: raw.additionalExits,
                acquisitionSites: raw.acquisitionSites,
                hasAcquisitionSites: true,
                path: `${path}.completionOccurrences[${index}]`,
              }),
              catalog,
              selectedPickupProducers(
                catalog,
                createBiomeAddress(routeKey, biomeKey),
                occurrenceBase,
              ),
              new Set(),
              undefined,
            );
      const decodedOccurrence = Object.freeze({
        ...occurrenceBase,
        ...(acquisitionSites === undefined ? {} : { acquisitionSites }),
        ...(keepsakeRack === undefined ? {} : { keepsakeRack }),
      });
      const actionPath = `${path}.completionOccurrences[${index}].roomActions.order`;
      const actionDomain = assembleRoomActionDomain({
        catalog,
        biome: createBiomeAddress(routeKey, biomeKey),
        occurrence: decodedOccurrence,
      });
      const activeActions = actionDomain.contributions.filter(
        (contribution): contribution is RoomActionContribution => contribution.kind === 'action',
      );
      const activeKeys = new Set(activeActions.map((action) => roomActionKey(action.reference)));
      const authoredKeys = roomActions.order.map(roomActionKey);
      if (new Set(authoredKeys).size !== authoredKeys.length)
        fail(actionPath, 'must not repeat a room action');
      for (const reference of roomActions.order) {
        const actionKey = roomActionKey(reference);
        if (
          reference.kind === 'sellPurgingPoolTrait' &&
          decodedOccurrence.purgingPool?.interacted !== true
        )
          fail(actionPath, 'contains a Pool sale while the Pool is not interacted with');
        const retainedClearedPoolSale =
          reference.kind === 'sellPurgingPoolTrait' &&
          decodedOccurrence.purgingPool?.traitKeyBySlot[reference.slotKey] === null;
        if (!activeKeys.has(actionKey) && !retainedClearedPoolSale)
          fail(actionPath, 'contains an inactive room action');
      }
      for (const action of activeActions)
        if (
          action.participation === 'required' &&
          !authoredKeys.includes(roomActionKey(action.reference))
        )
          fail(actionPath, `must include required ${action.reference.kind} action`);
      return decodedOccurrence;
    }),
  );
  const topology =
    plan.topology === null
      ? null
      : decodeBiomeTopology(plan.topology, catalog, layout, routeKey, `${path}.topology`);
  if (topology !== null) {
    const topologyIds = new Set(topology.occurrences.map((occurrence) => occurrence.occurrenceId));
    for (const occurrence of completionOccurrences) {
      if (topologyIds.has(occurrence.occurrenceId))
        fail(
          `${path}.completionOccurrences`,
          `${occurrence.occurrenceId} collides with editable topology`,
        );
    }
  }
  return Object.freeze({
    biomeKey,
    state: decodeBiomeState(plan.state, layout, `${path}.state`),
    topology,
    completionOccurrences,
    ...(plan.echoKeepsakeReplayResults === undefined
      ? {}
      : {
          echoKeepsakeReplayResults: (() => {
            const results = decodeKeepsakeEquipResults(
              plan.echoKeepsakeReplayResults,
              `${path}.echoKeepsakeReplayResults`,
              catalog,
            );
            if ('jeweledPom' in results && results.jeweledPom !== undefined)
              fail(`${path}.echoKeepsakeReplayResults.jeweledPom`, 'is not supported');
            return results;
          })(),
        }),
  });
}

function decodeRoutePlan(
  value: unknown,
  path: string,
  route: RouteDeclaration,
  catalog: Catalog,
): AuthoredRoutePlan {
  const arcanaCards = catalog.arcanaCards;
  const fearVows = catalog.fearVows;
  const plan = expectRecord(value, path);
  expectExactKeys(plan, ['routeKey', 'loadout', 'resourcePlacements', 'biomes'], path);

  const routeKey = expectString(plan.routeKey, `${path}.routeKey`);
  if (routeKey !== route.key) {
    fail(`${path}.routeKey`, `expected ${route.key}, received ${routeKey}`);
  }
  const rawResources = expectRecord(plan.resourcePlacements, `${path}.resourcePlacements`);
  expectExactKeys(
    rawResources,
    ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'],
    `${path}.resourcePlacements`,
  );

  const loadout = expectRecord(plan.loadout, `${path}.loadout`);
  expectExactKeys(
    loadout,
    [
      'weaponKey',
      'aspectKey',
      'manualArcanaKeys',
      'fearRanks',
      'startingKeepsakeKey',
      'keepsakeEquipResults',
    ],
    `${path}.loadout`,
  );
  const weaponKey = expectString(loadout.weaponKey, `${path}.loadout.weaponKey`);
  const aspectKey = expectString(loadout.aspectKey, `${path}.loadout.aspectKey`);
  const startingKeepsakeKey = expectString(
    loadout.startingKeepsakeKey,
    `${path}.loadout.startingKeepsakeKey`,
  );
  if (catalog.keepsakes.byKey[startingKeepsakeKey] === undefined)
    fail(`${path}.loadout.startingKeepsakeKey`, `unknown keepsake ${startingKeepsakeKey}`);
  const weapon = catalog.weapons.byKey[weaponKey];
  if (weapon === undefined) fail(`${path}.loadout.weaponKey`, `unknown weapon ${weaponKey}`);
  if (!weapon.aspectKeys.includes(aspectKey)) {
    fail(`${path}.loadout.aspectKey`, `${aspectKey} does not belong to ${weaponKey}`);
  }
  const manualArcanaKeys = expectArray(
    loadout.manualArcanaKeys,
    `${path}.loadout.manualArcanaKeys`,
  ).map((value, index) => expectString(value, `${path}.loadout.manualArcanaKeys[${index}]`));
  const manualSet = new Set<string>();
  for (const [index, key] of manualArcanaKeys.entries()) {
    const card = arcanaCards.byKey[key];
    if (card === undefined)
      fail(`${path}.loadout.manualArcanaKeys[${index}]`, `unknown Arcana ${key}`);
    if (card.activation.kind !== 'manual')
      fail(`${path}.loadout.manualArcanaKeys[${index}]`, `${key} is automatic`);
    if (manualSet.has(key)) fail(`${path}.loadout.manualArcanaKeys[${index}]`, `duplicates ${key}`);
    manualSet.add(key);
  }
  const canonicalManualArcanaKeys = arcanaCards.values
    .filter((card) => manualSet.has(card.key))
    .map((card) => card.key);
  const fearRanksRecord = expectRecord(loadout.fearRanks, `${path}.loadout.fearRanks`);
  expectExactKeys(
    fearRanksRecord,
    fearVows.values.map((vow) => vow.key),
    `${path}.loadout.fearRanks`,
  );
  const fearRanks: Record<string, number> = {};
  for (const vow of fearVows.values) {
    const rank = fearRanksRecord[vow.key];
    if (
      !Number.isInteger(rank) ||
      typeof rank !== 'number' ||
      rank < 0 ||
      rank > vow.incrementalFear.length
    )
      fail(
        `${path}.loadout.fearRanks.${vow.key}`,
        `must be an integer from 0 through ${vow.incrementalFear.length}`,
      );
    fearRanks[vow.key] = rank;
  }
  const grasp = assessStartingArcanaGrasp(catalog, canonicalManualArcanaKeys, fearRanks);
  if (!grasp.legal) {
    fail(
      `${path}.loadout.manualArcanaKeys`,
      `cost ${grasp.cost} exceeds starting Grasp capacity ${grasp.capacity}`,
    );
  }

  const rawBiomes = expectArray(plan.biomes, `${path}.biomes`);
  if (rawBiomes.length > route.biomeKeys.length) {
    fail(`${path}.biomes`, `exceeds the ${route.biomeKeys.length}-biome route`);
  }

  const biomes = rawBiomes.map((biome, index) => {
    const expectedBiomeKey = route.biomeKeys[index];
    if (expectedBiomeKey === undefined) {
      fail(`${path}.biomes[${index}]`, 'has no matching route biome');
    }
    return decodeBiomePlan(biome, `${path}.biomes[${index}]`, routeKey, expectedBiomeKey, catalog);
  });
  const resourcePlacements = Object.freeze(
    Object.fromEntries(
      (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).map((family) => {
        const value = rawResources[family];
        if (value === null) return [family, null];
        const placement = expectRecord(value, `${path}.resourcePlacements.${family}`);
        expectExactKeys(
          placement,
          ['biomeKey', 'occurrenceId'],
          `${path}.resourcePlacements.${family}`,
        );
        const biomeKey = expectString(
          placement.biomeKey,
          `${path}.resourcePlacements.${family}.biomeKey`,
        );
        const occurrenceId = expectString(
          placement.occurrenceId,
          `${path}.resourcePlacements.${family}.occurrenceId`,
        ) as import('./model').OccurrenceId;
        const biome = biomes.find((candidate) => candidate.biomeKey === biomeKey);
        if (
          biome === undefined ||
          ![...(biome.topology?.occurrences ?? []), ...biome.completionOccurrences].some(
            (candidate) => candidate.occurrenceId === occurrenceId,
          )
        )
          fail(`${path}.resourcePlacements.${family}`, 'must target an existing occurrence');
        return [family, Object.freeze({ biomeKey, occurrenceId })];
      }),
    ) as import('./model').ResourcePlacements,
  );

  return Object.freeze({
    routeKey,
    resourcePlacements,
    loadout: Object.freeze({
      weaponKey,
      aspectKey,
      manualArcanaKeys: Object.freeze(canonicalManualArcanaKeys),
      fearRanks: Object.freeze(fearRanks),
      startingKeepsakeKey,
      ...(loadout.keepsakeEquipResults === undefined
        ? {}
        : {
            keepsakeEquipResults: decodeKeepsakeEquipResults(
              loadout.keepsakeEquipResults,
              `${path}.loadout.keepsakeEquipResults`,
              catalog,
            ),
          }),
    }),
    biomes: Object.freeze(biomes),
  });
}

export function decodeProjectDocument(value: unknown, catalog: Catalog): ProjectDocument {
  const document = expectRecord(value, '$');
  expectExactKeys(document, ['schemaVersion', 'projectId', 'catalogVersion', 'routes'], '$');

  if (document.schemaVersion !== PROJECT_DOCUMENT_SCHEMA_VERSION) {
    fail(
      '$.schemaVersion',
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received ${String(document.schemaVersion)}`,
    );
  }

  const projectId = expectNonBlankString(document.projectId, '$.projectId');
  const catalogVersion = expectString(document.catalogVersion, '$.catalogVersion');
  if (catalogVersion !== catalog.version) {
    fail(
      '$.catalogVersion',
      `expected compatible catalog ${catalog.version}, received ${catalogVersion}`,
    );
  }

  const rawRoutes = expectArray(document.routes, '$.routes');
  const routesByKey = new Map<string, AuthoredRoutePlan>();

  for (const [index, rawRoute] of rawRoutes.entries()) {
    const path = `$.routes[${index}]`;
    const routeRecord = expectRecord(rawRoute, path);
    const routeKey = expectString(routeRecord.routeKey, `${path}.routeKey`);
    const route = catalog.routes.byKey[routeKey];
    if (route === undefined) {
      fail(`${path}.routeKey`, `unknown route ${routeKey}`);
    }
    if (routesByKey.has(routeKey)) {
      fail(`${path}.routeKey`, `duplicates route ${routeKey}`);
    }
    routesByKey.set(routeKey, decodeRoutePlan(routeRecord, path, route, catalog));
  }

  const routes = catalog.routes.values.map((route) => {
    const plan = routesByKey.get(route.key);
    if (plan === undefined) {
      fail('$.routes', `missing route ${route.key}`);
    }
    return plan;
  });

  if (routesByKey.size !== catalog.routes.values.length) {
    fail('$.routes', `must contain exactly ${catalog.routes.values.length} routes`);
  }

  return Object.freeze({
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    projectId,
    catalogVersion,
    routes: Object.freeze(routes),
  });
}

export function parseProjectDocument(json: string, catalog: Catalog): ProjectDocument {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    fail('$', 'must be valid JSON');
  }
  return decodeProjectDocument(value, catalog);
}

export function encodeProjectDocument(document: ProjectDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
