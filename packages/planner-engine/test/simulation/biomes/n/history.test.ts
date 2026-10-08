import { catalog } from '@run-planner/hades2-catalog';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';

function fixture() {
  const project = loadSurfaceNProject();
  const biome = simulateProject(catalog, project).route?.biomes.find(
    (candidate) => candidate.biomeKey === 'N',
  );
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
    throw new Error('N fixture did not complete validly');
  }
  const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
  if (hub?.kind !== 'hub') throw new Error('N fixture lost Hub decision');
  return { project, biome, hub, history: biome.history };
}

describe('N Hub lifecycle composition and history', () => {
  it('creates the persistent board in physical order, then local rooms only once', () => {
    const { hub, history } = fixture();
    const hubView = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(hub.room.origin),
    );
    const combat02 = hub.visits.find((visit) => visit.target.hubSlotKey === 'combat02');
    if (hubView === undefined || combat02 === undefined)
      throw new Error('fixture lost Hub history');

    expect(
      hubView.targetGenerations
        .slice(0, hub.board.targets.length)
        .map((entry) => semanticAddressKey(entry.targetOrigin)),
    ).toEqual(hub.board.targets.map((target) => semanticAddressKey(target.origin)));
    expect(hubView.targetGenerations.at(-1)?.targetOrigin).toMatchObject({
      kind: 'target',
      exitKey: 'preboss',
    });
    expect(
      history.ledgers.roomCreations
        .filter(
          (event) =>
            event.source === 'localVisit' &&
            semanticAddressKey(event.parentOrigin) ===
              semanticAddressKey(combat02.target.room.origin),
        )
        .map((event) => event.gameName),
    ).toEqual(['N_Sub03', 'N_Sub01']);
    expect(
      history.ledgers.roomCreations.filter((event) => event.source === 'hubTarget'),
    ).toHaveLength(9);
    expect(
      history.ledgers.roomCreations
        .filter((event) => event.source === 'generatedTarget')
        .map((event) => event.gameName),
    ).toContain('N_PreBoss01');
  });

  it('spawns and completes one required Soul Pylon around every visited main encounter', () => {
    const { hub, history } = fixture();
    expect(history.ledgers.requiredObjectSpawns).toHaveLength(6);
    expect(history.ledgers.requiredObjectCompletions).toHaveLength(6);
    expect(history.afterTransition.ledgers.counters).toMatchObject({
      soulPylonsSpawned: 6,
      soulPylonsCompleted: 6,
      biomeEncounterDepth: 0,
      routeEncounterDepth: 8,
    });

    const firstMain = hub.visits[0]?.target.room;
    if (firstMain === undefined) throw new Error('fixture lost first visit');
    const kinds = history.events
      .filter(
        (event) =>
          'origin' in event &&
          semanticAddressKey(event.origin) === semanticAddressKey(firstMain.origin),
      )
      .map((event) => event.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'roomEntered',
        'requiredObjectSpawned',
        'encounterStarted',
        'encounterCompleted',
        'requiredObjectCompleted',
        'producerRoleAdvanced',
        'outgoingGenerationCheckpoint',
      ]),
    );
  });

  it('records parent and Hub restores without recreating encountered rooms', () => {
    const { hub, history } = fixture();
    const combat05 = hub.visits[0];
    if (combat05 === undefined) throw new Error('fixture lost first visit');
    const combat05Key = semanticAddressKey(combat05.target.room.origin);

    expect(
      history.ledgers.roomRestores.filter(
        (restore) => semanticAddressKey(restore.origin) === combat05Key,
      ),
    ).toHaveLength(2);
    expect(
      history.ledgers.roomRestores.filter(
        (restore) => semanticAddressKey(restore.origin) === semanticAddressKey(hub.room.origin),
      ),
    ).toHaveLength(6);
    expect(
      history.ledgers.roomCreations.filter(
        (event) => semanticAddressKey(event.origin) === combat05Key,
      ),
    ).toHaveLength(1);
  });

  it('departs once per native LeaveRoom, including restored main-room and Hub departures', () => {
    const { hub, history } = fixture();
    const key = semanticAddressKey;
    const sideRoomCounts = hub.visits.map((visit) => visit.enteredLocalRooms.length);
    expect(sideRoomCounts).toContain(0);
    expect(Math.max(...sideRoomCounts)).toBeGreaterThanOrEqual(2);

    // Every arrival after the biome's first room follows exactly one door use out of the previous room.
    type Contact = { readonly kind: 'arrival' | 'departure'; readonly room: string };
    const contacts = history.events.flatMap((event): Contact[] =>
      event.kind === 'roomEntered' || event.kind === 'roomRestored'
        ? [{ kind: 'arrival', room: key(event.origin) }]
        : event.kind === 'roomDeparted'
          ? [{ kind: 'departure', room: key(event.origin) }]
          : [],
    );
    contacts.forEach((contact, index) => {
      expect(contact.kind).toBe(index % 2 === 0 ? 'arrival' : 'departure');
      if (contact.kind === 'departure') expect(contact.room).toBe(contacts[index - 1]!.room);
    });
    expect(contacts.at(-1)?.kind).toBe('departure');

    // Hub → main, main → each side room and back, main → Hub; then Hub → Handoff.
    const hubKey = key(hub.room.origin);
    const expected = [
      ...hub.visits.flatMap((visit) => {
        const main = key(visit.target.room.origin);
        return [
          hubKey,
          main,
          ...visit.enteredLocalRooms.flatMap((side) => [key(side.origin), main]),
        ];
      }),
      hubKey,
    ];
    const departures = contacts.filter((contact) => contact.kind === 'departure');
    const firstHub = departures.findIndex((contact) => contact.room === hubKey);
    expect(
      departures.slice(firstHub, firstHub + expected.length).map((contact) => contact.room),
    ).toEqual(expected);
    expect(departures.filter((contact) => contact.room === hubKey)).toHaveLength(
      hub.visits.length + 1,
    );
    const exits = history.events.filter((event) => event.kind === 'roomExited');
    expect(new Set(exits.map((event) => key(event.origin))).size).toBe(exits.length);
    expect(departures.length - exits.length).toBe(
      hub.visits.length + sideRoomCounts.reduce((total, count) => total + count, 0),
    );
  });

  it('folds deterministic sequence numbers and the derived transition reset', () => {
    const { history } = fixture();
    expect(history.events.map((event) => event.sequence)).toEqual(
      Array.from({ length: history.events.length }, (_, index) => index + 1),
    );
    expect(history.events.some((event) => event.kind === 'biomeCompleted')).toBe(true);
    expect(
      history.events
        .filter((event) => event.kind === 'biomeCounterReset')
        .map((event) => event.axis),
    ).toEqual(['biomeDepthCache', 'biomeEncounterDepth']);
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history.events)).toBe(true);
  });
});
