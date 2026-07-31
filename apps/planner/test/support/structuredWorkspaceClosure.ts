import {
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalChildGroupAddress,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type OccurrenceId,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';

import type {
  ExpectedWorkspaceLeafInteractionKind,
  ExpectedWorkspaceLeafRequirement,
} from './structuredWorkspaceExpectations';
import type {
  ExpectedWorkspaceStructuralControl,
  ExpectedWorkspaceStructuralControlKind,
} from './structuredWorkspaceStructuralControls';

type UnknownRecord = Record<string, unknown>;

interface MarkerLike {
  readonly address: SemanticAddress;
  readonly focusKey: string;
}

function record(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : undefined;
}

function values(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function marker(value: unknown): MarkerLike | undefined {
  const candidate = record(value);
  if (candidate === undefined || typeof candidate.focusKey !== 'string') return undefined;
  const address = candidate.address;
  if (record(address) === undefined || typeof record(address)?.kind !== 'string') return undefined;
  return candidate as unknown as MarkerLike;
}

function requiredRecord(value: unknown, detail: string): UnknownRecord {
  const candidate = record(value);
  if (candidate === undefined) throw new Error(`${detail} is not a workspace product`);
  return candidate;
}

function requiredString(value: unknown, detail: string): string {
  if (typeof value !== 'string') throw new Error(`${detail} is missing`);
  return value;
}

function appendMarker(markers: MarkerLike[], value: unknown): void {
  const candidate = marker(value);
  if (candidate !== undefined) markers.push(candidate);
}

/**
 * This is intentionally a structural walk over the public workspace shape,
 * not a call to marker ownership or a projection producer. It lets tests make
 * a marker omitted by a producer observable without reconstructing payloads.
 */
function roomMarkers(room: unknown): readonly MarkerLike[] {
  const result: MarkerLike[] = [];
  const roomRecord = requiredRecord(room, 'workspace room');
  appendMarker(result, roomRecord.marker);
  for (const control of values(roomRecord.rewardControls)) {
    appendMarker(result, record(control)?.marker);
  }
  const local = record(roomRecord.roomLocal);
  if (local === undefined) return result;
  switch (local.kind) {
    case 'fixed':
      appendMarker(result, local.marker);
      appendMarker(result, record(local.control)?.marker);
      break;
    case 'incomingReward':
      appendMarker(result, record(local.control)?.marker);
      break;
    case 'ephyra': {
      appendMarker(result, record(local.incomingReward)?.marker);
      const sideRooms = record(local.sideRooms);
      const group =
        sideRooms === undefined || sideRooms.kind !== 'published'
          ? undefined
          : record(sideRooms.group);
      if (group === undefined) break;
      appendMarker(result, group.marker);
      for (const slot of values(group.slots)) {
        const slotRecord = requiredRecord(slot, 'Ephyra side room');
        appendMarker(result, slotRecord.marker);
        appendMarker(result, record(slotRecord.rewardControl)?.marker);
      }
      break;
    }
    case 'fields':
      for (const cage of values(local.cages)) {
        appendMarker(result, record(record(cage)?.control)?.marker);
      }
      break;
    case 'ship':
      for (const wheel of values(local.wheels)) {
        const wheelRecord = requiredRecord(wheel, 'reward wheel');
        appendMarker(result, wheelRecord.marker);
        for (const offer of values(wheelRecord.offers)) {
          appendMarker(result, record(record(offer)?.control)?.marker);
        }
      }
      break;
    case 'shop':
      for (const offer of values(local.offers)) {
        const offerRecord = requiredRecord(offer, 'shop offer');
        appendMarker(result, record(offerRecord.purchase)?.marker);
        appendMarker(result, record(offerRecord.rewardControl)?.marker);
      }
      break;
    case 'none':
      break;
    default:
      throw new Error(`unknown workspace room local ${String(local.kind)}`);
  }
  return result;
}

/** Hub boards own only a room's declaration-defined main reward, not local detail. */
function hubMainRewardMarker(room: unknown): MarkerLike | undefined {
  const local = record(requiredRecord(room, 'Hub room').roomLocal);
  if (local === undefined) return undefined;
  switch (local.kind) {
    case 'fixed':
      return marker(local.marker);
    case 'incomingReward':
      return marker(record(local.control)?.marker);
    case 'ephyra':
      return marker(record(local.incomingReward)?.marker);
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return undefined;
    default:
      throw new Error(`unknown Hub room local ${String(local.kind)}`);
  }
}

function markersForWorkspaceNode(node: unknown): readonly MarkerLike[] {
  const result: MarkerLike[] = [];
  const nodeRecord = requiredRecord(node, 'workspace node');
  appendMarker(result, nodeRecord.marker);
  switch (nodeRecord.kind) {
    case 'linkedExit': {
      const target = requiredRecord(nodeRecord.target, 'linked target');
      appendMarker(result, target.marker);
      result.push(...roomMarkers(target.room));
      break;
    }
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      appendMarker(result, nodeRecord.selection);
      appendMarker(result, nodeRecord.rewardStore);
      appendMarker(result, nodeRecord.fieldsCageOutcome);
      for (const target of values(nodeRecord.targets)) {
        const targetRecord = requiredRecord(target, 'batch target');
        appendMarker(result, targetRecord.marker);
        result.push(...roomMarkers(targetRecord.room));
      }
      break;
    case 'hubDecision':
      appendMarker(result, nodeRecord.openSet);
      for (const slot of values(nodeRecord.slots)) {
        const slotRecord = requiredRecord(slot, 'Hub slot');
        appendMarker(result, slotRecord.marker);
        if (slotRecord.room !== undefined)
          appendMarker(result, hubMainRewardMarker(slotRecord.room));
      }
      for (const visit of values(nodeRecord.visits)) {
        appendMarker(result, record(visit)?.marker);
      }
      break;
    case 'occurrenceWorkbench':
      appendMarker(result, nodeRecord.railMarker);
      for (const localMarker of values(nodeRecord.localDetailMarkers)) {
        appendMarker(result, localMarker);
      }
      result.push(...roomMarkers(nodeRecord.room));
      break;
    case 'completion':
      break;
    default:
      throw new Error(`unknown workspace node ${String(nodeRecord.kind)}`);
  }
  return result;
}

/** Collect marker ownership from the public node contract without producer helpers. */
export function workspaceMarkers(nodes: readonly unknown[]): readonly MarkerLike[] {
  return nodes.flatMap((node) => markersForWorkspaceNode(node));
}

function markerByOwner(nodes: readonly unknown[]): ReadonlyMap<string, MarkerLike> {
  const markers = new Map<string, MarkerLike>();
  for (const workspaceMarker of workspaceMarkers(nodes)) {
    const key = semanticAddressKey(workspaceMarker.address);
    const prior = markers.get(key);
    if (prior !== undefined && prior.focusKey !== workspaceMarker.focusKey) {
      throw new Error(`${key} has conflicting workspace markers`);
    }
    markers.set(key, workspaceMarker);
  }
  return markers;
}

function nodesByKey(nodes: readonly unknown[]): ReadonlyMap<string, UnknownRecord> {
  const result = new Map<string, UnknownRecord>();
  for (const node of nodes) {
    const nodeRecord = requiredRecord(node, 'workspace node');
    const key = requiredString(nodeRecord.key, 'workspace node key');
    if (result.has(key)) throw new Error(`${key} has multiple workspace nodes`);
    result.set(key, nodeRecord);
  }
  return result;
}

function markerNodeKeys(nodes: readonly unknown[]): ReadonlyMap<string, ReadonlySet<string>> {
  const result = new Map<string, Set<string>>();
  for (const node of nodes) {
    const key = requiredString(requiredRecord(node, 'workspace node').key, 'workspace node key');
    for (const workspaceMarker of markersForWorkspaceNode(node)) {
      const markerKey = semanticAddressKey(workspaceMarker.address);
      const nodeKeys = result.get(markerKey) ?? new Set<string>();
      nodeKeys.add(key);
      result.set(markerKey, nodeKeys);
    }
  }
  return result;
}

interface WorkspaceRoomPackage {
  readonly nodeKey: string;
  readonly room: UnknownRecord;
}

/**
 * Room packages are public semantic products, not a promise that every room
 * owns a standalone occurrence-workbench node. Ordinary targets can live
 * solely inside their containing decision workbench.
 */
function roomPackagesForWorkspaceNode(node: unknown): readonly WorkspaceRoomPackage[] {
  const nodeRecord = requiredRecord(node, 'workspace node');
  const nodeKey = requiredString(nodeRecord.key, 'workspace node key');
  const packageFor = (room: unknown, detail: string): WorkspaceRoomPackage =>
    Object.freeze({ nodeKey, room: requiredRecord(room, detail) });
  switch (nodeRecord.kind) {
    case 'occurrenceWorkbench':
      return Object.freeze([packageFor(nodeRecord.room, `${nodeKey} occurrence workbench room`)]);
    case 'linkedExit': {
      const target = requiredRecord(nodeRecord.target, `${nodeKey} linked target`);
      return Object.freeze([packageFor(target.room, `${nodeKey} linked target room`)]);
    }
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return Object.freeze(
        values(nodeRecord.targets).map((target) => {
          const targetRecord = requiredRecord(target, `${nodeKey} batch target`);
          return packageFor(targetRecord.room, `${nodeKey} batch target room`);
        }),
      );
    case 'hubDecision':
      return Object.freeze(
        values(nodeRecord.slots).flatMap((slot) => {
          const room = record(requiredRecord(slot, `${nodeKey} Hub slot`).room);
          return room === undefined ? [] : [packageFor(room, `${nodeKey} Hub slot room`)];
        }),
      );
    case 'completion':
      return Object.freeze([]);
    default:
      throw new Error(`unknown workspace node ${String(nodeRecord.kind)}`);
  }
}

function roomPackagesByOccurrence(
  nodes: readonly unknown[],
): ReadonlyMap<OccurrenceId, readonly WorkspaceRoomPackage[]> {
  const result = new Map<OccurrenceId, WorkspaceRoomPackage[]>();
  for (const node of nodes) {
    for (const roomPackage of roomPackagesForWorkspaceNode(node)) {
      const occurrenceId = requiredString(
        roomPackage.room.occurrenceId,
        `${roomPackage.nodeKey} workspace room occurrence identity`,
      ) as OccurrenceId;
      const packages = result.get(occurrenceId);
      if (packages === undefined) result.set(occurrenceId, [roomPackage]);
      else packages.push(roomPackage);
    }
  }
  return new Map(
    [...result.entries()].map(
      ([occurrenceId, packages]) => [occurrenceId, Object.freeze(packages)] as const,
    ),
  );
}

function assertExactDestination(
  address: SemanticAddress,
  focusByOwner: ReadonlyMap<string, unknown>,
  reachableNodes: ReadonlyMap<string, UnknownRecord>,
  markerNodes: ReadonlyMap<string, ReadonlySet<string>>,
  detail: string,
  requireMarkerContainment = false,
): void {
  const key = semanticAddressKey(address);
  const destination = requiredRecord(focusByOwner.get(key), `${detail} ${key} destination`);
  const owner = destination.ownerAddress as SemanticAddress | undefined;
  if (owner === undefined || semanticAddressKey(owner) !== key) {
    throw new Error(`${detail} ${key} has no exact workspace destination`);
  }
  if (destination.region !== 'structure' || destination.nodeKey === undefined) {
    throw new Error(`${detail} ${key} does not resolve to a workspace node`);
  }
  const subject = record(destination.inspectorSubject);
  if (
    subject?.kind !== 'node' ||
    subject.nodeKey !== destination.nodeKey ||
    !reachableNodes.has(requiredString(destination.nodeKey, `${detail} destination node key`)) ||
    (requireMarkerContainment &&
      !markerNodes
        .get(key)
        ?.has(requiredString(destination.nodeKey, `${detail} destination node key`)))
  ) {
    throw new Error(`${detail} ${key} has no exact workspace inspector destination`);
  }
}

function interactionMapName(kind: ExpectedWorkspaceLeafInteractionKind): string {
  switch (kind) {
    case 'reward':
      return 'rewards';
    case 'rewardWheelOfferCount':
      return 'rewardWheelOfferCounts';
    case 'rewardWheelPick':
      return 'rewardWheelPicks';
    case 'rewardWheelStore':
      return 'rewardWheelStores';
    case 'shipEncounterCount':
      return 'shipEncounterCounts';
    case 'shopPurchase':
      return 'shopPurchases';
    case 'sideRoomEntryOrder':
      return 'sideRoomEntryOrders';
    case 'sideRoomGeneration':
      return 'sideRoomGenerations';
  }
}

function leafInteractionLabel(kind: ExpectedWorkspaceLeafInteractionKind): string {
  switch (kind) {
    case 'shopPurchase':
      return 'Shop purchase';
    case 'shipEncounterCount':
      return 'Ship encounter count';
    default:
      return kind;
  }
}

function leafInteractionOwner(
  kind: ExpectedWorkspaceLeafInteractionKind,
  address: SemanticAddress,
): SemanticAddress {
  if (kind === 'sideRoomEntryOrder' && address.kind === 'localChild') {
    return createLocalChildGroupAddress(
      { biomeKey: address.biomeKey, kind: 'biome', routeKey: address.routeKey },
      address.occurrenceId,
      address.groupKey,
    );
  }
  return address;
}

function interactionOwnerKey(interaction: unknown): string | undefined {
  const owner = record(record(interaction)?.owner);
  if (owner === undefined) return undefined;
  const nestedAddress = owner.address;
  const address = record(nestedAddress) === undefined ? owner : nestedAddress;
  return record(address) === undefined ? undefined : semanticAddressKey(address as SemanticAddress);
}

function mapGet(map: unknown, key: string): unknown {
  if (map === null || typeof map !== 'object' || !('get' in map)) return undefined;
  const getter = (map as { readonly get?: unknown }).get;
  return typeof getter === 'function' ? getter.call(map, key) : undefined;
}

function structuralInteractionMapName(kind: ExpectedWorkspaceStructuralControlKind): string {
  switch (kind) {
    case 'batchRewardStore':
      return 'batchRewardStores';
    case 'exitFrontierCapability':
      return 'exitFrontierCapabilities';
    case 'exitSelection':
      return 'exitSelections';
    case 'fieldsCageOutcome':
      return 'fieldsCageOutcomes';
    case 'hubSlot':
      return 'hubSlots';
    case 'hubVisit':
      return 'hubVisits';
    case 'roomPicker':
      return 'rooms';
    case 'start':
      return 'starts';
    case 'structural':
      return 'structural';
    case 'takeoverBatch':
      return 'takeoverBatches';
    case 'topologyRemoval':
      return 'topologyRemovals';
  }
}

function assertExactInteraction(
  interactions: UnknownRecord,
  mapName: string,
  key: string,
  owner: SemanticAddress | undefined,
  detail: string,
): void {
  const interaction = mapGet(interactions[mapName], key);
  if (interaction === undefined) throw new Error(`${detail} has no exact workspace interaction`);
  const interactionRecord = requiredRecord(interaction, `${detail} interaction`);
  if (interactionRecord.key !== undefined && interactionRecord.key !== key) {
    throw new Error(`${detail} has a conflicting workspace interaction key`);
  }
  if (owner !== undefined && interactionOwnerKey(interaction) !== semanticAddressKey(owner)) {
    throw new Error(`${detail} has a conflicting workspace interaction owner`);
  }
}

/**
 * Independent expected-side closure for non-leaf controls. The expected list
 * comes only from authored topology and declarations; this function reads the
 * final public interaction catalog and never compares command payloads.
 */
export function assertExpectedWorkspaceStructuralControlClosure(input: {
  readonly controls: readonly ExpectedWorkspaceStructuralControl[];
  readonly interactions: object;
}): void {
  const interactions = requiredRecord(input.interactions, 'workspace interactions');
  for (const control of input.controls) {
    const mapName = structuralInteractionMapName(control.kind);
    assertExactInteraction(
      interactions,
      mapName,
      control.key,
      control.kind === 'exitFrontierCapability' ? undefined : control.owner,
      `${control.kind} ${control.key}`,
    );
  }
}

function assertRenderedRoomControls(room: unknown, interactions: UnknownRecord): void {
  const roomRecord = requiredRecord(room, 'workspace room');
  const roomPicker = record(roomRecord.roomPicker);
  if (roomPicker !== undefined) {
    const address = roomPicker.address as SemanticAddress | undefined;
    if (address === undefined) throw new Error('room picker has no semantic owner');
    assertExactInteraction(
      interactions,
      'rooms',
      semanticAddressKey(address),
      address,
      `room picker ${semanticAddressKey(address)}`,
    );
  }
}

function assertRenderedNodeControls(node: UnknownRecord, interactions: UnknownRecord): void {
  switch (node.kind) {
    case 'occurrenceWorkbench': {
      assertRenderedRoomControls(node.room, interactions);
      const staged = record(node.sourceDecisionRemoval);
      if (staged !== undefined) {
        const key = requiredString(staged.interactionKey, 'staged decision removal key');
        assertExactInteraction(
          interactions,
          'topologyRemovals',
          key,
          undefined,
          `staged decision removal ${key}`,
        );
      }
      return;
    }
    case 'linkedExit': {
      const owner = node.owner as SemanticAddress | undefined;
      if (owner === undefined) throw new Error('linked exit has no owner');
      assertExactInteraction(
        interactions,
        'topologyRemovals',
        semanticAddressKey(owner),
        owner,
        `linked-exit topology removal ${semanticAddressKey(owner)}`,
      );
      return;
    }
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch': {
      const owner = node.owner as SemanticAddress | undefined;
      if (owner === undefined) throw new Error(`${String(node.kind)} has no owner`);
      if (values(node.targets).length !== 1) {
        const selection = marker(node.selection);
        if (selection === undefined)
          throw new Error(`${semanticAddressKey(owner)} has no selection marker`);
        assertExactInteraction(
          interactions,
          'exitSelections',
          selection.focusKey,
          owner,
          `exit selection ${selection.focusKey}`,
        );
      }
      const rewardStore = marker(node.rewardStore);
      if (rewardStore !== undefined) {
        assertExactInteraction(
          interactions,
          'batchRewardStores',
          rewardStore.focusKey,
          rewardStore.address,
          `batch reward store ${rewardStore.focusKey}`,
        );
      }
      const fieldsCage = marker(node.fieldsCageOutcome);
      if (fieldsCage !== undefined) {
        assertExactInteraction(
          interactions,
          'fieldsCageOutcomes',
          fieldsCage.focusKey,
          owner,
          `Fields cage outcome ${fieldsCage.focusKey}`,
        );
      }
      if (node.kind === 'takeoverBatch') {
        const takeoverKey = requiredString(node.takeoverInteractionKey, 'takeover interaction key');
        assertExactInteraction(
          interactions,
          'takeoverBatches',
          takeoverKey,
          owner,
          `takeover batch ${takeoverKey}`,
        );
      }
      assertExactInteraction(
        interactions,
        'topologyRemovals',
        semanticAddressKey(owner),
        owner,
        `decision topology removal ${semanticAddressKey(owner)}`,
      );
      for (const target of values(node.targets)) {
        assertRenderedRoomControls(record(target)?.room, interactions);
      }
      return;
    }
    case 'hubDecision': {
      if (node.authoring !== 'authored') return;
      for (const slot of values(node.slots)) {
        const slotRecord = requiredRecord(slot, 'Hub slot');
        const slotMarker = marker(slotRecord.marker);
        if (slotMarker === undefined) throw new Error('Hub slot has no marker');
        assertExactInteraction(
          interactions,
          'hubSlots',
          slotMarker.focusKey,
          slotMarker.address,
          `Hub slot ${slotMarker.focusKey}`,
        );
        if (
          slotRecord.canClose === true &&
          record(mapGet(interactions.hubSlots, slotMarker.focusKey))?.close === undefined
        ) {
          throw new Error(
            `${slotMarker.focusKey} closable Hub slot has no exact close interaction`,
          );
        }
      }
      for (const visit of values(node.visits)) {
        const visitRecord = requiredRecord(visit, 'Hub visit');
        if (visitRecord.authoring === 'locked') continue;
        const visitMarker = marker(visitRecord.marker);
        if (visitMarker === undefined) throw new Error('Hub visit has no marker');
        assertExactInteraction(
          interactions,
          'hubVisits',
          visitMarker.focusKey,
          visitMarker.address,
          `Hub visit ${visitMarker.focusKey}`,
        );
      }
      return;
    }
    case 'completion':
      return;
    default:
      throw new Error(`unknown workspace node ${String(node.kind)}`);
  }
}

/**
 * Final public-product test closure. It catches a rendered structural control
 * or advertised frontier capability whose exact bound interaction was omitted,
 * without recreating requirement payloads in production.
 */
export function assertRenderedWorkspaceStructuralControlClosure(input: {
  readonly interactions: object;
  readonly routes: readonly unknown[];
}): void {
  const interactions = requiredRecord(input.interactions, 'workspace interactions');
  for (const route of input.routes) {
    const routeRecord = requiredRecord(route, 'workspace route');
    for (const biome of values(routeRecord.biomes)) {
      const biomeRecord = requiredRecord(biome, 'workspace biome');
      for (const node of values(biomeRecord.nodes)) {
        assertRenderedNodeControls(requiredRecord(node, 'workspace node'), interactions);
      }
      const entry = record(biomeRecord.entry);
      if (entry !== undefined) {
        const biomeMarker = marker(biomeRecord.marker);
        if (biomeMarker === undefined) throw new Error('workspace biome has no marker');
        assertExactInteraction(
          interactions,
          'topologyRemovals',
          biomeMarker.focusKey,
          biomeMarker.address,
          `biome topology removal ${biomeMarker.focusKey}`,
        );
      }
      const frontier = record(biomeRecord.frontier);
      if (frontier === undefined) continue;
      const owner = frontier.owner as SemanticAddress | undefined;
      switch (frontier.kind) {
        case 'start': {
          const frontierKey = requiredString(frontier.interactionKey, 'start interaction key');
          if (owner === undefined) throw new Error(`start frontier ${frontierKey} has no owner`);
          assertExactInteraction(
            interactions,
            'starts',
            frontierKey,
            owner,
            `start frontier ${frontierKey}`,
          );
          break;
        }
        case 'hubDecision': {
          const frontierKey = requiredString(
            frontier.interactionKey,
            'Hub frontier interaction key',
          );
          if (owner === undefined)
            throw new Error(`Hub creation frontier ${frontierKey} has no owner`);
          assertExactInteraction(
            interactions,
            'structural',
            frontierKey,
            owner,
            `Hub creation frontier ${frontierKey}`,
          );
          break;
        }
        case 'exitDecision': {
          const frontierKey = requiredString(
            frontier.interactionKey,
            'exit frontier interaction key',
          );
          if (owner === undefined) throw new Error(`exit frontier ${frontierKey} has no owner`);
          const capability = mapGet(interactions.exitFrontierCapabilities, frontierKey);
          if (capability === undefined) break;
          const capabilityRecord = requiredRecord(capability, `frontier capability ${frontierKey}`);
          if (capabilityRecord.structural !== undefined) {
            assertExactInteraction(
              interactions,
              'structural',
              frontierKey,
              owner,
              `exit frontier structural action ${frontierKey}`,
            );
          }
          if (capabilityRecord.takeover === true) {
            assertExactInteraction(
              interactions,
              'takeoverBatches',
              frontierKey,
              owner,
              `exit frontier takeover action ${frontierKey}`,
            );
          }
          break;
        }
        case 'hubOpenSet':
        case 'hubVisit':
          break;
        default:
          throw new Error(`unknown workspace frontier ${String(frontier.kind)}`);
      }
    }
  }
}

/**
 * Independent test closure for declaration-owned editable leaves. It verifies
 * the exact marker, final containing inspector subject, and interaction
 * identity; it intentionally does not compare interaction payloads.
 */
export function assertExpectedWorkspaceLeafClosure(input: {
  readonly focusByOwner: ReadonlyMap<string, unknown>;
  readonly interactions: object;
  readonly nodes: readonly unknown[];
  readonly requirements: readonly ExpectedWorkspaceLeafRequirement[];
}): void {
  const markers = markerByOwner(input.nodes);
  const reachableNodes = nodesByKey(input.nodes);
  const markerNodes = markerNodeKeys(input.nodes);
  const interactionCatalog = requiredRecord(input.interactions, 'workspace interactions');
  for (const requirement of input.requirements) {
    const key = semanticAddressKey(requirement.address);
    const workspaceMarker = markers.get(key);
    if (workspaceMarker === undefined) {
      throw new Error(`${key} required authored leaf has no workspace marker`);
    }
    if (semanticAddressKey(workspaceMarker.address) !== key) {
      throw new Error(`${key} required authored leaf resolves to a conflicting workspace marker`);
    }
    assertExactDestination(
      requirement.address,
      input.focusByOwner,
      reachableNodes,
      markerNodes,
      'required authored leaf',
      true,
    );
    for (const expected of requirement.interactions) {
      const interaction = mapGet(
        interactionCatalog[interactionMapName(expected.kind)],
        expected.key,
      );
      if (interaction === undefined) {
        throw new Error(
          `authored ${leafInteractionLabel(expected.kind)} leaf ${key} has no exact workspace interaction`,
        );
      }
      const interactionRecord = requiredRecord(interaction, `${expected.kind} interaction`);
      if (
        interactionRecord.key !== expected.key ||
        interactionOwnerKey(interaction) !==
          semanticAddressKey(leafInteractionOwner(expected.kind, requirement.address))
      ) {
        throw new Error(
          `authored ${leafInteractionLabel(expected.kind)} leaf ${key} has a conflicting workspace interaction`,
        );
      }
    }
  }
}

function exactlyOne<T>(valuesToCheck: readonly T[], detail: string): T {
  if (valuesToCheck.length !== 1) {
    throw new Error(
      `${detail} resolves to ${valuesToCheck.length} workspace products instead of one`,
    );
  }
  return valuesToCheck[0]!;
}

function ownerKey(value: unknown): string | undefined {
  const owner = record(value);
  return owner === undefined ? undefined : semanticAddressKey(owner as unknown as SemanticAddress);
}

function nodeOwnerMatches(node: UnknownRecord, address: SemanticAddress): boolean {
  return ownerKey(node.owner) === semanticAddressKey(address);
}

interface StructurallyOwnedOccurrence {
  readonly detail: string;
  readonly gameName: string;
  readonly occurrenceId: OccurrenceId;
}

/**
 * The core validates orphan and multiply-owned occurrence records. This
 * independent projection oracle closes only the packages actually owned by
 * authored structure: the start, exit targets, and Hub slots.
 */
function structurallyOwnedOccurrences(
  plan: AuthoredBiomePlan,
): readonly StructurallyOwnedOccurrence[] {
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const occurrences = new Map<OccurrenceId, (typeof topology.occurrences)[number]>();
  for (const occurrence of topology.occurrences) {
    if (occurrences.has(occurrence.occurrenceId)) {
      throw new Error(`${plan.biomeKey} occurrence ${occurrence.occurrenceId} is duplicated`);
    }
    occurrences.set(occurrence.occurrenceId, occurrence);
  }
  const owners = new Map<OccurrenceId, StructurallyOwnedOccurrence>();
  const own = (occurrenceId: OccurrenceId, detail: string): void => {
    const occurrence = occurrences.get(occurrenceId);
    if (occurrence === undefined) {
      throw new Error(`${detail} references missing occurrence ${occurrenceId}`);
    }
    if (owners.has(occurrenceId)) {
      throw new Error(`${detail} gives occurrence ${occurrenceId} multiple structural owners`);
    }
    owners.set(
      occurrenceId,
      Object.freeze({ detail, gameName: occurrence.gameName, occurrenceId }),
    );
  };
  own(topology.startOccurrenceId, `${plan.biomeKey} start`);
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      for (const target of decision.openTargets) {
        own(
          target.occurrenceId,
          `${plan.biomeKey} Hub ${decision.hubKey} slot ${target.hubSlotKey}`,
        );
      }
      continue;
    }
    if (decision.normal.kind === 'linked') {
      own(
        decision.normal.occurrenceId,
        `${plan.biomeKey} linked target ${decision.normal.exitKey}`,
      );
      continue;
    }
    for (const target of decision.normal.targets) {
      own(target.occurrenceId, `${plan.biomeKey} target ${target.exitKey}`);
    }
  }
  return Object.freeze([...owners.values()]);
}

/**
 * Independently closes persisted topology over final public workspace nodes.
 * It derives owners from the authored plan and deliberately does not read
 * source indexes, assembly products, marker ownership, or presentation.
 */
export function assertAuthoredWorkspaceTopologyClosure(input: {
  readonly biome: BiomeAddress;
  readonly focusByOwner: ReadonlyMap<string, unknown>;
  readonly nodes: readonly unknown[];
  readonly plan: AuthoredBiomePlan;
}): void {
  const topology = input.plan.topology;
  if (topology === null) return;
  const nodes = input.nodes.map((node) => requiredRecord(node, 'workspace node'));
  const reachableNodes = nodesByKey(input.nodes);
  const markers = markerByOwner(input.nodes);
  const markerNodes = markerNodeKeys(input.nodes);
  const roomPackages = roomPackagesByOccurrence(input.nodes);
  const assertOwner = (
    address: SemanticAddress,
    detail: string,
    requireMarkerContainment = false,
  ): void => {
    if (!markers.has(semanticAddressKey(address))) {
      throw new Error(`${detail} has no workspace marker`);
    }
    assertExactDestination(
      address,
      input.focusByOwner,
      reachableNodes,
      markerNodes,
      detail,
      requireMarkerContainment,
    );
  };
  for (const occurrence of structurallyOwnedOccurrences(input.plan)) {
    const packages = roomPackages.get(occurrence.occurrenceId);
    if (packages === undefined || packages.length === 0) {
      throw new Error(
        `${occurrence.detail} occurrence ${occurrence.occurrenceId} has no reachable workspace room package`,
      );
    }
    const conflictingPackage = packages.find(
      (roomPackage) => roomPackage.room.gameName !== occurrence.gameName,
    );
    if (conflictingPackage !== undefined) {
      throw new Error(
        `${occurrence.detail} occurrence ${occurrence.occurrenceId} projects ${String(conflictingPackage.room.gameName)} instead of ${occurrence.gameName}`,
      );
    }
    assertOwner(
      createOccurrenceAddress(input.biome, occurrence.occurrenceId),
      `${occurrence.detail} occurrence ${occurrence.occurrenceId}`,
      true,
    );
  }
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      const owner = createHubDecisionAddress(input.biome, decision.hubKey);
      const hub = exactlyOne(
        nodes.filter((node) => node.kind === 'hubDecision' && nodeOwnerMatches(node, owner)),
        `${semanticAddressKey(owner)} Hub`,
      );
      assertOwner(owner, `${semanticAddressKey(owner)} Hub`);
      for (const target of decision.openTargets) {
        const slot = exactlyOne(
          values(hub.slots).filter(
            (candidate) => record(candidate)?.hubSlotKey === target.hubSlotKey,
          ),
          `${semanticAddressKey(owner)} slot ${target.hubSlotKey}`,
        );
        const slotRecord = requiredRecord(slot, 'Hub slot');
        const room = record(slotRecord.room);
        if (slotRecord.open !== true || room?.occurrenceId !== target.occurrenceId) {
          throw new Error(
            `${semanticAddressKey(owner)} slot ${target.hubSlotKey} omits its authored occurrence`,
          );
        }
        assertOwner(
          createHubSlotAddress(input.biome, decision.hubKey, target.hubSlotKey),
          `${semanticAddressKey(owner)} slot ${target.hubSlotKey}`,
          true,
        );
      }
      for (const [index, slotKey] of decision.visitOrder.entries()) {
        const visit = exactlyOne(
          values(hub.visits).filter((candidate) => record(candidate)?.visitIndex === index + 1),
          `${semanticAddressKey(owner)} visit ${index + 1}`,
        );
        const visitRecord = requiredRecord(visit, 'Hub visit');
        if (visitRecord.authoring !== 'authored' || visitRecord.hubSlotKey !== slotKey) {
          throw new Error(`${semanticAddressKey(owner)} visit ${index + 1} omits authored order`);
        }
        assertOwner(
          createHubVisitAddress(input.biome, decision.hubKey, index + 1),
          `${semanticAddressKey(owner)} visit ${index + 1}`,
          true,
        );
      }
      continue;
    }
    const owner = createExitDecisionAddress(input.biome, decision.source);
    const decisionNode = exactlyOne(
      nodes.filter(
        (node) =>
          (node.kind === 'linkedExit' ||
            node.kind === 'ordinaryBatch' ||
            node.kind === 'mixedBatch' ||
            node.kind === 'takeoverBatch') &&
          nodeOwnerMatches(node, owner),
      ),
      `${semanticAddressKey(owner)} decision`,
    );
    assertOwner(owner, `${semanticAddressKey(owner)} decision`);
    if (decision.normal.kind === 'linked') {
      const target = requiredRecord(
        decisionNode.target,
        `${semanticAddressKey(owner)} linked target`,
      );
      const room = requiredRecord(target.room, `${semanticAddressKey(owner)} linked room`);
      if (
        decisionNode.kind !== 'linkedExit' ||
        target.exitKey !== decision.normal.exitKey ||
        room.occurrenceId !== decision.normal.occurrenceId
      ) {
        throw new Error(`${semanticAddressKey(owner)} omits its authored linked target`);
      }
      assertOwner(
        createTargetAddress(input.biome, decision.source, decision.normal.exitKey),
        `${semanticAddressKey(owner)} target ${decision.normal.exitKey}`,
        true,
      );
      continue;
    }
    if (decisionNode.kind === 'linkedExit') {
      throw new Error(`${semanticAddressKey(owner)} projects a linked exit for an authored batch`);
    }
    for (const target of decision.normal.targets) {
      const projectedTarget = exactlyOne(
        values(decisionNode.targets).filter(
          (candidate) => record(candidate)?.exitKey === target.exitKey,
        ),
        `${semanticAddressKey(owner)} target ${target.exitKey}`,
      );
      const room = requiredRecord(
        record(projectedTarget)?.room,
        `${semanticAddressKey(owner)} target room`,
      );
      if (room.occurrenceId !== target.occurrenceId) {
        throw new Error(
          `${semanticAddressKey(owner)} target ${target.exitKey} omits its authored occurrence`,
        );
      }
      assertOwner(
        createTargetAddress(input.biome, decision.source, target.exitKey),
        `${semanticAddressKey(owner)} target ${target.exitKey}`,
        true,
      );
    }
  }
}
