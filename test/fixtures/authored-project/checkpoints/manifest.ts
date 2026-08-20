import type { ProjectDocument } from '@run-planner/engine/authored-project';

export interface AuthoredProjectCheckpointManifestEntry {
  readonly id: string;
  readonly file: string;
  readonly route: 'Underworld' | 'Surface';
  readonly configuredBiomePrefix: readonly string[];
  readonly scenario: string;
  readonly schemaVersion: 48;
  readonly catalogVersion: string;
  readonly sha256: string;
  readonly provenance: string;
}

export const checkpointManifest = Object.freeze([
  {
    id: 'underworld-fg',
    file: 'underworld-fg.runplanner.json',
    route: 'Underworld',
    configuredBiomePrefix: ['F', 'G'],
    scenario: 'Canonical Underworld F/G route prefix',
    schemaVersion: 48,
    catalogVersion: '0.27.0-arcana-fear-loadout',
    sha256: '464309464a8c980fb16d70db1675e33c50b025a2154ead38ed107ec70150164a',
    provenance: 'createCompleteFGProject()',
  },
  {
    id: 'underworld-fgh',
    file: 'underworld-fgh.runplanner.json',
    route: 'Underworld',
    configuredBiomePrefix: ['F', 'G', 'H'],
    scenario: 'Canonical Underworld F/G/H route prefix',
    schemaVersion: 48,
    catalogVersion: '0.27.0-arcana-fear-loadout',
    sha256: 'c698a42eb6e33fef3b814fca3f34f709608523a51c2a9bb271e13ca3ebba160e',
    provenance: 'createGoldenFGHProject()',
  },
  {
    id: 'underworld-fghi',
    file: 'underworld-fghi.runplanner.json',
    route: 'Underworld',
    configuredBiomePrefix: ['F', 'G', 'H', 'I'],
    scenario: 'Canonical Underworld F/G/H/I route prefix',
    schemaVersion: 48,
    catalogVersion: '0.27.0-arcana-fear-loadout',
    sha256: '009882fcee5e763900b3570cc82c9c9ee07360e222d90057f138176757851467',
    provenance: 'createGoldenFGHIProject()',
  },
  {
    id: 'surface-n',
    file: 'surface-n.runplanner.json',
    route: 'Surface',
    configuredBiomePrefix: ['N'],
    scenario: 'Canonical Surface N Hub route prefix',
    schemaVersion: 48,
    catalogVersion: '0.27.0-arcana-fear-loadout',
    sha256: 'f769871cf6a8acce6059b52c86bd36ffa12c8789e8015f72ef162cd05ec268a4',
    provenance: 'createRepresentativeNProject()',
  },
  {
    id: 'surface-no',
    file: 'surface-no.runplanner.json',
    route: 'Surface',
    configuredBiomePrefix: ['N', 'O'],
    scenario: 'Canonical Surface N/O route prefix',
    schemaVersion: 48,
    catalogVersion: '0.27.0-arcana-fear-loadout',
    sha256: 'cf38175fa8efe1a574ac1f509ac3ed82005193619bbda5c81767baec24666952',
    provenance: 'createRepresentativeNOProject()',
  },
  {
    id: 'surface-nop',
    file: 'surface-nop.runplanner.json',
    route: 'Surface',
    configuredBiomePrefix: ['N', 'O', 'P'],
    scenario: 'Canonical Surface N/O/P route prefix',
    schemaVersion: 48,
    catalogVersion: '0.27.0-arcana-fear-loadout',
    sha256: '0b895c9df76429745c0e3ce47d9e66099f70489cb80a05dce226d0356dd27300',
    provenance: 'createRepresentativeNOPProject()',
  },
  {
    id: 'surface-nopq',
    file: 'surface-nopq.runplanner.json',
    route: 'Surface',
    configuredBiomePrefix: ['N', 'O', 'P', 'Q'],
    scenario: 'Canonical Surface N/O/P/Q route prefix',
    schemaVersion: 48,
    catalogVersion: '0.27.0-arcana-fear-loadout',
    sha256: '128aa0a247077275db33e9366c6c024aa86ab125a5829d3f3e7449ffadd987dd',
    provenance: 'createRepresentativeNOPQProject()',
  },
] as const satisfies readonly AuthoredProjectCheckpointManifestEntry[]);

export type AuthoredProjectCheckpointId = (typeof checkpointManifest)[number]['id'];

export const checkpointManifestById: Readonly<
  Record<AuthoredProjectCheckpointId, AuthoredProjectCheckpointManifestEntry>
> = Object.freeze(
  Object.fromEntries(checkpointManifest.map((entry) => [entry.id, entry])) as unknown as Record<
    AuthoredProjectCheckpointId,
    AuthoredProjectCheckpointManifestEntry
  >,
);

export function checkpointManifestEntryFor(
  id: AuthoredProjectCheckpointId,
): AuthoredProjectCheckpointManifestEntry {
  return checkpointManifestById[id];
}

export type CheckpointDocument = ProjectDocument;
