# Encounter Preparation

## Purpose

This document owns how a room's encounter phases are authored, resolved to
concrete Encounter Definitions, prepared and recorded before entry: encounter
choices, identity resolution, generated composition and its customization,
enemy introductions, and per-encounter event choices.

The [Room Lifecycle Model](ROOM_LIFECYCLE_MODEL.md) owns when preparation runs
(`prepareRoom`, after the predecessor commits) and what encounter start,
completion and end effects do afterward. [Trait
Offers](TRAIT_OFFERS.md#encounter-owned-offers) owns an encounter's trait
offer. The biome documents own each room's encounter sets and NPC candidates;
the [encounter audits](../audits/README.md) own native pools, waves and
budgets.

## Encounter choices

`RoomOccurrence.encounters.encounterKeyByPhase` persists a catalog-declared
authoring choice key for every pool-backed potential slot of that room's
envelope. Each choice has a friendly label and an explicit mapping to a
concrete Encounter Definition. Most map directly; contextual choices such as
Combat map from the room's reward context. Existing choice keys may also be
native definition names, but that spelling does not make them resolved
identities. Fixed slots are bound directly by the Room Declaration and persist
no choice; a slot in an empty Encounter Envelope carries none either.

A catalog choice declares its invariant structural kind and either a direct
definition or an explicit reward-context mapping. The room's slot binding
selects that mapping; labels never select native definitions. Combat can keep
its authored identity while resolving a reward-owned Trial or an I goal
variant. Each visible choice has one concrete meaning within a room, phase and
known context. Distinct available choices must have distinguishable friendly
labels; labels may repeat in different rooms or phases.

A generated N side room is an ordinary referenced occurrence and keeps the same
map on that occurrence. The parent-sourced local-visit decision owns only
generation and visit topology. The map does not store an Encounter Set key,
free-form category, NPC family, or rendered phase ordinal.

Potential selections remain with their owning room through unpick/repick,
side-room generation and entry-order changes, optional-slot trimming, Undo,
and Redo. A structurally dormant slot emits no active control, candidate,
finding, history, counter, phase-owned reward effect, or NPC index row, but its
selection remains ready for reactivation. Replacing a declaration reconciles
only compatible stable phase keys and gives newly introduced or incompatible
slots their declaration defaults. Deleting an occurrence deletes its owned
selections; deleting its parent-owned local-visit target removes the same
occurrence and downstream state atomically.

An active retained selection may become context-invalid after a different
semantic edit. It remains persisted and repairable; the authored model never
falls back to another choice. `SelectEncounter` accepts a declared authoring
choice from the phase's Encounter Set at one structurally addressable
occurrence, including a dormant or context-invalid selection.
`ResetEncounter` restores the set's static declared default even when that
default is dormant or currently invalid; it is a reset, not an automatic
repair.

## Identity resolution

Concrete identity resolution belongs to the engine's encounter resolver, not
the command or editor. `prepareRoom` resolves identity and then assesses that
definition at the post-predecessor-commit checkpoint. Eligibility never selects
another identity: an unavailable selected NPC receives a finding rather than
being replaced by Combat. A reward edit may change the resolved definition
behind Combat without changing the persisted choice.

The identity context distinguishes known reward type, known no-reward, and
unavailable authorship, and carries the route. A declared first-biome identity
(the route's own key where the choice declares one, else its default) resolves
at reached biome encounter depth one (an unset depth reads as zero and does
not match) before reward context, but only while that definition has not yet
been recorded on the route. For the intro keys this mirrors native
`AlwaysForce` until completion; the mature Chronos intro is natively forced at
depth one once `ClockworkIntro` is completed, which is equivalent within one
route because I occurs once. A non-counting intro such as `FishmanIntro`
therefore leaves the next combat at depth one resolving ordinary identity. A
Clockwork goal disposition takes precedence over the incoming reward. Missing
reached facts for a first-biome identity, or missing contextual authorship,
does not select ordinary Combat. A value authored for a decision the choice's
members own but the resolved intro does not is retained removal-only, as for an
entry-contextual replacement.

Direct bindings need no reward context. Structural traversal uses the same
identity resolver without claiming eligibility, and never borrows behavior
from a choice's namesake or first possible definition. Materialization
publishes known structural identities when their inputs are known. An
unentered room whose identity requires unreached depth publishes no concrete
execution phase; entered execution translation consumes its recorded identity.

A fixed binding may declare a Rival alternative on the same physical map. It
resolves from configured Rivals and route position, using the same rule as
completion-map selection, without persisting an encounter choice.
Materialization carries the resolved fixed identity; authored-first controls
use that same resolver even before evaluation. Fixed Shadow miniboss variants
instead resolve during preparation from effective Fear, since prior Black Night
Banishment can suppress Shadow. Their materialized base identity retains the
same lifecycle and authoring domain; the recorded prepared identity is
published to the executor.

## Recording and activation

Only a resolved phase carries effective encounter behavior. For each valid
active slot, preparation appends an `encounterRecorded` event before entry. The
event carries the definition key, envelope key, stable slot key, and exact
room-instance origin. Encounter effects and execution publication consume that
concrete identity, not the authored choice. Consumers must not recover those
facts from a maximum-capacity Room Declaration: an H Min outcome activates only
its two-cage prefix even though the declaration's complete envelope retains
the third cage.

A later slot in the same room evaluates against the preceding recorded prefix.
It can therefore observe exact earlier encounter identities, while encounter
counters remain at the post-predecessor snapshot until the matching
`encounterStarted` event. Previous-room spacing is a different view: it
examines committed predecessor room origins and excludes every slot owned by
the room currently being prepared. Its identity-bearing preparation window
preserves repeated appearances and the native departing-room duplication;
encounter requirements and NPC shopping protection consume this same view.
These are checkpointed projections of one canonical event fold, not a profile
baseline, provisional counter slate, or NPC-specific ledger.

An active retained selection that fails its requirements, or a slot whose
activation fails, is not replaced. Every active phase's authored identity is
recorded and the room is entered; the phase's finding blocks at the room's
Overview, before any phase start, counter, reward, completion or room commit.
Later structurally active slots remain authorable from the valid record
prefix. A valid definition-owned `terminateSuffix` effect may end the
remaining active sequence; an invalid selection never performs that trim.
Dormant slots retain their authored choice but emit no lifecycle product. When
preparation assesses a suffix as dormant, the lifecycle structure and Room
Action roster are scoped to the active prefix
([lifecycle structure](ROOM_LIFECYCLE_MODEL.md#lifecycle-structure-and-authoring-timeline)).

## Generated composition

Optional generated-composition assessment uses the resolved phase's exact
preparation context. Ordered selection accounts for fixed/highlight seeds,
exclusions and known prior explicit selections; native rosters do not become
invented blacklist facts. Assessment returns typed repair evidence and a
complete resolved composition: budgets, ordered source entries,
generated/effective request counts and applicable Fangs/Menace outcomes.
Initialization and preview consume the same exact capability. Every phase's
identity and composition, missing or invalid, is located for repair at its
room's preparation, the room Overview. Combat and native spawn pacing are not
simulated. Composition introduces no lifecycle operation, reward obligation or
conformance checkpoint.

A declaration may fix leading waves. They count toward the wave total and its
native budget shares (a two-wave profile generates only its 50% suffix), take
no shared highlight and are never regenerated or published; the suffix keeps
its native wave indices. A named WaveTemplate seed opens every generated wave
and receives a sampled budget like any generated member. An all-fixed combat
identity instead declares its complete native roster.

The engine's encounter composition view presents one resolved combat phase
from its identity, authored decisions and, when available, the exact generated
assessment. It names a disposition—`fixed`, `fixedWavePrefix` with the prefix
length, `generated` (authored) or `nativeGenerated` (not authored)—the
declared wave bounds and known count, and one row per wave with its source
(`fixed`, `authored` or `native`) and editability. Fixed rows carry declared
counts; authored rows carry their seeds and additions with assessed counts;
native rows exist only up to an exact declared wave count. Shared-enemy and
Fear applicability follow the same assessment. The view is authoring
presentation: it adds no lifecycle operation, finding or execution content.

### Customization

Concrete Encounter Definitions may declare optional decisions with stable
keys, display labels, native operands and a single-choice, bounded distinct
ordered-prefix, generated-composition, infinite-roster, or inclusive integer
cocoon-count domain, or room-specific cocoon reward-point domain. The resolved
definition owns the active domain, including normal/Rival differences;
customization does not independently calculate Rivals.

`encounters.customizationByPhase[phaseKey][decisionKey]` retains sparse
authored choices. Omission means Default, with no required edit. Fixed
encounter identity does not prevent customization. Commands enforce structural
shape and declaration-known values, including a cocoon count's declared range.
Decoding and room reconciliation enforce the same values, except that they
retain a structurally valid out-of-range cocoon count for a preparation
finding. The independent `cocoonRewardPoint` value stores a positive integral
native `spawnPointId`; omission is Any. Its legal domain is the host room's
ordered catalog anchors, while a structurally valid ID outside that domain
remains finding-backed and repairable. Count and point resets remove only their
own decision. Execution publication carries the native ID, never its displayed
map number or coordinates.

Preparation assesses support against the resolved encounter. Same-family values
made unavailable by an upstream edit remain repairable rather than silently
changing. Dormant phases emit no active settings or findings, and structural
replacement reconciles compatible phase ownership. A customization the
route-free binding owned on a phase that a contextual entry rule fixes on this
route (a GeneratedF customization on Fresh File `F_Combat01`) decodes, reports
`encounterCustomizationUnavailable` without generating from it, and can only be
removed.

The exact phase owns each finding, with the decision identified in evidence.
Valid resolved choices travel with that phase into execution publication, not
as room features or additional Timeline actions. A choice steers a native
decision if reached; it does not oblige an attack, advance a clock or create a
checkpoint.

Generated composition is native or fully customized. Absence leaves generation
native. A customized value owns concrete wave/base-budget choices, shared
highlight where applicable, ordered per-wave additions and nonnegative budget
allocation requests for sampled branches. Fixed seeds and remainder
allocations remain declaration/engine-owned. The engine resolves native-order
clamping, minimum-one, ceilings, count caps and redistribution into complete
generated counts; allocations need not sum to the wave budget and are not
relative weights or direct counts.

An infinite roster is native or one ordered list of distinct declared types
within the declared type bounds, for an encounter whose native counts are
infinite. Commands and decoding enforce that shape; preparation assesses depth
gates, draw-order exclusions and the elite limit at the phase's exact
checkpoint. It owns no wave, budget, count, highlight, Fangs or Menace choice.

Applicable Fangs choices own one elite source type and an ordered legal perk
assignment. Menace choices own converted source-request counts and, for
random-pool sources, one replacement identity per source per wave. Omitted
Menace settings mean zero conversions, not native rolls. Counts describe
source spawn requests, not final entities after groups, summons or respawns.
Native perk application, spawn timing, positions and combat remain outside
authored state.

Opening the editor is read-only. Explicit customization initialization uses
the exact reached engine capability and commits a complete starting value as
one semantic edit. Reset removes the whole customization; there are no inner
native defaults. Upstream edits and migration preserve structurally
representable choices, including dormant values; missing or incompatible
active choices remain repairable and prevent publication instead of requesting
partial native generation.

## Enemy introductions

A fresh profile starts with every enemy introduction unfinished; a mature save
has completed them all. Native `SetupEncounter` replaces a drawn encounter with
the introduction of an unintroduced enemy it contains. The planner models this
as resolved identity: each reachable enemy-triggered introduction is a member
of its biome set, and the author selects the identity native would resolve. The
model preserves the set of native-legal outcomes, not native selection order or
probabilities.
[Fresh File Rules](../biomes/FRESH_FILE_RULES.md) list each biome's reachable
introductions.

- **Member gate.** A declared requirement: route `FreshFile`, not completed on
  the route, in H not recorded this run, and for Lycanthrope the Mourner,
  Lovesick and Lamia introductions recorded on the route. The choices are
  route-scoped to `FreshFile`, so mature pickers keep their rows and cannot
  select them; the route clause still rejects a retained selection.
- **Reachability.** A member whose gate passes is still ineligible unless an
  eligible ordinary identity in the same slot could draw one of its trigger
  enemies at that checkpoint. The exclusion names those trigger enemies.
- **Admission.** An enemy whose introduction is unfinished is never drawn where
  the encounter requires completed introductions or where biome depth (the
  native depth cache, not encounter depth) is below the biome's
  `MinDepthBeforeIntros` (3; H 0). An enemy's declared profile gate is also
  admission, evaluated at preparation: WaterUnit after a completed
  `MiniBossWaterUnit`, SiegeVine after an earlier `MiniBossFogEmitter`, and
  never the ordinary Turtle on a fresh profile. `TurtleIntro` is therefore
  reached only through `Turtle_Elite`.
- **Trigger exclusion.** An admissible enemy whose introduction's gate passes
  at this checkpoint would trigger it, so the ordinary identity excludes it,
  naming that introduction. Where the gate fails (Lycanthrope before its
  prerequisites, Mourner in a cage after an earlier cage recorded
  `MournerIntro`) the enemy stays admissible, as natively. An introduction's
  own suffix applies the same rules; its seed is declared, not drawn.

A retained enemy whose introduction is unfinished and that is inadmissible or
would now trigger reports `encounterIntroductionRequired`, naming the
introduction and whether selecting it is the repair; a profile-gate failure
(WaterUnit, SiegeVine, the ordinary Turtle) reports
`encounterCustomizationUnavailable`. Either value is retained. A selected
introduction whose gate or reachability lapses after an upstream edit reports
`encounterUnavailable`.

H cage members are evaluated in cage-preparation order against the records of
earlier cages, not their completions. A prepared cage is never re-prepared when
an earlier cage completes; only later preparation sees that completion.

Composition stays optional on every route. Each reached generated phase
publishes the enemies its native roll must not draw: its trigger-exclusion set
at its checkpoint (empty once every introduction is complete), then each
once-per-run (`BlacklistAfterFirstAppearance`) enemy it could draw that a later
authored composition in the run draws through native eligibility (typed
additions, template companions or the highlight). The list never repeats
native admission and never names a gated unfinished introduction, which spawns
without substitution. It governs an uncustomized phase's roll, and an authored
phase's only when its composition is declined. The native roll is otherwise
unmodelled, so an uncustomized phase records exactly its selected identity. A
contextually replaced decision stays removal-only. Fangs and Menace controls
follow effective Fear, so they stay hidden on a fresh profile.

## Encounter events

`encounters.aetosWaveByPhase[phaseKey]` sparsely owns a requested Aetos wave,
independently of generated composition. Omission requests no planned
appearance; there is no persisted checkbox or Native mode. `ReplaceAetosWave`
authors or removes the value as one semantic edit. Composition reset does not
remove it. Structural phase reconciliation retains compatible ownership and
deletes removed owners; context-invalid selections remain authored and
repairable at the exact event.

Aetos assessment consumes each reached phase's resolved declaration, Outdoor
room tag, skip disposition, exact wave domain and earlier reached valid Aetos
selection. Native GeneratedP supports requesting wave 2 without forcing its
variable wave count; native Large supports 2 or 3; customized composition uses
its exact assessed wave count. A valid requested wave is recorded on that
phase's `encounterStarted` history entry. This reserves at most one appearance
per Olympus biome without claiming a native spawn occurred. Dormant phases,
unpicked choices and unassessed suffixes reserve nothing and create no event
findings; a selected invalid phase retains its exact repair owner. Fig Leaf
skip invalidates a reached appearance; Gorgon alone does not. Aetos creates no
wave, enemy budget, reward, counter advancement or automatic end effect, and
its native runtime outcome is best-effort and is not folded back into planner
history.

These event choices share an encounter-local presentation without replacing
the independent Fig Leaf and Gorgon authored contracts.
