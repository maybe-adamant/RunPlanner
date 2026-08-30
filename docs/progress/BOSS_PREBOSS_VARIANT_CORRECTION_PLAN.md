# Boss and Preboss Variant Correction Plan

## Status

**Locked for implementation.** This focused correction interrupts the F/G game
execution plan after Gate C and before Gate D. Its base planner commit is
`ab7031445693fd6f4dba583fa9124e945a41511a`; its base Plan Executor commit is
`69148aa461fda36c3a243e85b219ca81a0029207`.

## Objective

Persist the exact game room and encounter selected by Vow of Rivals and by the
route-specific Tartarus Preboss rule without exposing either physical variant
as an authoring choice. A published execution plan must name the room the game
will actually use.

## Source facts and planner baseline

- `IsBossDifficultyShrineUpgradeActive` compares the configured
  `BossDifficultyShrineUpgrade` rank with `CurrentRun.EnteredBiomes`. Rivals is
  active when the rank reaches the current one-based route position.
- F, G, H, N, O, and Q have distinct `Boss01` and `Boss02` room declarations
  with distinct boss encounter identities. P and I retain one Boss room and
  apply Rivals inside that room.
- Dream Runs add a persistent-history guard for the enhanced encounter. The
  planner's established fully progressed baseline treats that guard as met; it
  does not add a save-profile input.
- `I_PreBoss01` is the Dream-Run/pre-true-ending map. `I_PreBoss02` is the
  progressed, non-Dream map. The current Underworld route therefore keeps
  `I_PreBoss02`; a later Dream Dive route must select `I_PreBoss01`.

## Locked model

### Catalog ownership

Each physical Boss variant is a real normalized room declaration and each
physical boss encounter is a real normalized encounter declaration. Declaration
source may share genuinely identical planner-facing fragments, but the
normalized catalog does not alias `Boss02` to `Boss01`. Source differences such
as H Boss02 resource support remain explicit.

Each biome completion declaration owns its normal Boss game name and, where the
game has one, its Rivals Boss game name. Route declarations own the exact
Preboss game name for each included biome. Catalog closure proves that every
named variant belongs to the expected biome and room kind.

One pure engine query resolves the expected completion Boss from:

```text
completion variants + zero-based route position + configured Rivals rank
```

It selects the Rivals room only when a distinct variant exists and
`rank >= routePosition + 1`. P and I therefore keep `Boss01` at every rank.
Circe requires no branch because Rivals is not removable.

### Authored topology ownership

Selecting a Preboss creates the resolved Boss occurrence and the existing
route-position Postboss occurrence with the current fixed occurrence IDs.
Changing `BossDifficultyShrineUpgrade` through `ReplaceFearVowRank` atomically
reconciles every already-created completion Boss in the configured route:

- the Boss occurrence ID and fixed links remain stable;
- its exact room game name and fixed encounter state change to the newly
  resolved declaration;
- compatible occurrence-local state remains on that occurrence;
- declaration-incompatible state remains representable and finding-backed
  under the existing contextual-repair policy rather than moving to another
  occurrence; and
- Undo restores the prior rank and every prior Boss identity as one semantic
  edit.

The strict codec accepts only the route's declared Preboss identity and the
completion's declared Boss variant family. Contextual agreement between the
persisted Boss variant and the current rank is command/simulation policy, not a
second raw-document reconstruction path.

### Application and UX ownership

There is no React or workspace feature. Candidate products expose only the one
route-selected Preboss. Boss/Preboss labels, rail nodes, Overview, Timeline,
Doors, and Vow controls remain unchanged.

## Catalog and protocol version

The normalized room and encounter collection changes, so the catalog version
advances once. Authored fixtures, execution fixtures, the execution compiler's
exact version, and the Plan Executor's strict version contact advance together.
The authored schema remains 73 because no JSON field or union shape changes.

## Delivery gates and commits

### Gate A — planner/catalog correction

One `feat(planner)` commit owns:

- durable audit dispositions;
- route-selected Preboss declarations;
- completion Boss variant declarations and normalization;
- the six Boss02 room/encounter declarations;
- the pure Boss resolver;
- Preboss creation and atomic Rivals-rank reconciliation;
- codec, catalog, command, simulation, execution compiler, and unchanged-UX
  contract witnesses; and
- the catalog-version/fixture refresh.

Primary tests belong to catalog normalization/closure and authored-project
topology/command suites. Representative simulation and execution tests prove
that the exact resolved game name reaches canonical fixed links and execution
JSON. Application tests prove only that the existing Vow edit remains one
command and Preboss candidates do not reveal variants.

### Gate B — Plan Executor synchronization

One `chore(executor)` commit updates the strict catalog-version contact and
copies the newly generated canonical execution fixtures. Its decoder/session
semantics do not change. The shell repository then receives one submodule-pin
commit and preserves unrelated dirty submodules.

## Required witnesses

- Rank zero creates F/G/H/N/O/Q Boss01.
- Ranks one through four activate a distinct Boss02 exactly when the reached
  route position is covered; P and I remain Boss01.
- Raising and lowering Rivals after fixed completion creation rewrites all and
  only affected Boss occurrences atomically, preserves their IDs/links, and is
  undoable through existing history publication.
- Underworld exposes and persists only `I_PreBoss02`.
- A route declaration using the Dream mapping resolves I to `I_PreBoss01`
  without adding a second picker option.
- Boss02 uses its matching `Boss...02` encounter and reaches execution JSON.
- Existing Boss-local state and route resource placement addresses remain
  attached to the stable occurrence ID across a variant change.
- Strict decoding rejects a Preboss outside the route mapping and a Boss
  outside the declared completion family.

## Exclusions

- implementing Dream Dive route authoring;
- adding true-ending or prior-encounter save-profile inputs;
- exposing Boss or Preboss variants in the UI;
- modeling boss combat mechanics beyond the existing fixed encounter surface;
- changing Vow of Rivals ranks, Fear totals, Circe eligibility, or runtime
  execution behavior; and
- starting F/G execution Gate D before this correction closes.

## Closure

After both repositories and the shell pin pass their focused checks, absorb the
stable authored/catalog conclusions into the owning design and audit documents,
record the catalog advance in implementation progress, delete this temporary
plan, commit closure, and resume the F/G execution plan at Gate D.
