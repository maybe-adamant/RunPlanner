# Chaos Traits Implementation

## Status

Locked delivery plan grounded on clean base
`0b4ae57ac7c7fee98fb15134ba00545225681588`. The plan was checked against the
source-complete Chaos trait audit, the landed boon-rarity ledger, natural-Chaos
topology, reward-child authoring, trait history, Arcana/Fear state, exact room
lifecycle events, trait-offer candidates, Run State, the contextual trait
editor, and the schema-50 checkpoint corpus. Independent adversarial review
found no remaining P1/P2 correction.

This is a temporary implementation plan. It must not be linked from the README
or stable design documents. At closure, absorb the completed model into the
smallest durable authorities and delete this file.

Owning evidence and stable authorities:

- [`CHAOS_TRAIT_GAME_DATA_AUDIT.md`](../audits/CHAOS_TRAIT_GAME_DATA_AUDIT.md)
- [`BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md`](../audits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md)
- [`ARCANA_AND_FEAR_GAME_DATA_AUDIT.md`](../audits/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md)
- [`TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`](../audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md)
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md)
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md)
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md)

## Objective

Make every natural `TrialUpgrade` a real, replayable Chaos outcome with one
selected curse/blessing pair, exact processed rolls, a derived active curse
clock, and atomic maturation into its pending blessing.

The user-visible result is:

- the entered Chaos room's required `TrialUpgrade` action opens a specialized
  Chaos outcome editor through the existing trait-child interaction;
- the editor records the selected curse, duration, blessing, shared rarity,
  and only the numeric operands actually rolled by those declarations;
- Run State shows active curses, pending blessings, remaining clock uses, and
  matured Chaos blessings;
- maturation follows existing encounter-end, room-exit, and eligible god-loot
  screen checkpoints rather than a draggable Room Timeline action;
- Creation contributes elements only after maturation;
- Favor contributes its exact processed value to the landed rarity ledger;
- Ordinary forces affected offers to Common while active;
- Rejected retains all three generated options while one exact option is
  visible but unselectable and not Rarifiable;
- Barren suppresses the existing modeled Arcana consequences until maturity;
  and
- every other Chaos identity is a fully modeled trait in catalog, authoring,
  history, Run State, and export, while only its unsupported gameplay effect is
  simulation-neutral.

Natural-Chaos gates, maps, room selection, required reward pickup, and return
continuations already work. This plan starts at the `TrialUpgrade` reward child
and does not redesign that topology.

## Source facts and chosen planner representation

### Persist the selected pair, not a fabricated sequential choice

The game generates up to three already-paired alternatives. Blessings are
distinct across those rows; curses may repeat. The player selects one complete
pair against one pre-pickup context.

The planner deliberately persists only the selected pair outcome. The two
unselected Chaos alternatives have no modeled chronological consequence, no
Denial-style later ownership, and are not required to replay the resulting
run. Persisting all three would enlarge every numeric payload and candidate
surface without improving simulation or export of the selected result.

The editor may stage the selected outcome as curse, duration, blessing,
rarity, and declaration-owned numeric controls. That staged presentation must
not imply that the game first chooses a curse and then grants a free blessing
choice. The engine validates the complete pair against the same immutable
pre-pickup branch.

Use the existing reward-child owner:

```text
TrialUpgrade
  -> acquisition role self
  -> TraitOfferAddress
  -> AuthoredRewardState.traitOffersByAcquisitionRole.self
  -> ReplaceTraitOffer
```

Extend `AuthoredTraitOffer` with one distinct closed branch conceptually shaped
as:

```text
Chaos offer
  kind = chaos
  giver = Chaos
  selected pair
    curse key
    rolled duration
    exact declaration-owned curse numeric values
    blessing key
    shared rarity
    exact declaration-owned blessing numeric values
```

Do not add a Chaos-specific address, command family, reward field, persisted
editor step, selected maturity position, or second candidate registry.

`TrialUpgrade` remains source-backed Echo Reward Reward Reward replay material.
The replayed acquisition owns the same `self` Chaos child, complete-pair
assessment, settlement, clock start, editor, findings, and history semantics as
the direct Chaos-room pickup. It is not a second Chaos model. The generic
reward-child path must work at both the occurrence incoming-reward address and
the derived Echo replay acquisition-entry address.

### Numeric payloads are declaration-closed operands, not an effect DSL

Catalog declarations own the complete 17-curse and 16-blessing pools and the
exact value domains audited in `CHAOS_TRAIT_GAME_DATA_AUDIT.md`.

Normalize one small Chaos-only numeric operand descriptor containing:

- stable operand key and player-facing label;
- final legal domain or range;
- integer/step/precision rules needed to validate authored processed values;
  and
- whether the value is independently rolled or derived from rarity/context.

The persisted outcome contains only independently rolled values:

- every curse has one authored duration;
- exactly nine curses have one additional authored numeric operand;
- eleven blessings have one authored numeric operand;
- Revelation has two independently authored operands; and
- Creation, Celerity, Chant, and Defiance store no redundant within-rarity
  roll because their values are derived from rarity or current context.

The codec and semantic command require the exact operand-key set for the
selected declarations. Unknown keys, missing required keys, duplicate keys,
non-finite values, and values outside the normalized domain fail structurally.
This descriptor is validation and presentation metadata only. It must not
become a generic executable modifier language.

### Pair rarity and eligibility are closed

The selected pair has one rarity:

- ordinary pairs allow Common, Rare, or Epic;
- Defiance's fixed Legendary blessing takes precedence;
- otherwise Barren forces its paired blessing to Heroic; and
- no other ordinary Chaos path authors Heroic or Legendary.

Pair assessment uses one pre-pickup branch and the source-backed eligibility
facts already named by the audit: elements, weapon/aspect, keepsake, run type,
and prior matured Chaos history. A pending blessing does not count as equipped,
does not contribute elements, and does not satisfy the prior-Chaos requirement
for Defiance or Barren.

Creation's progressed-save availability remains the established external
baseline. Discovery's Dream Run/bounty exclusions remain source facts, but
this slice must not invent a Dream Dive authored flag merely to expose them;
until that input exists, candidate assessment follows the planner's supported
normal-run baseline and the audit records the deferred context.

### History is instance-based and derived

Repeated Chaos visits may select the same curse or blessing, and more than one
curse may overlap. The ordinary `equippedTraits` map is keyed by trait identity
and cannot own this chronology by itself.

Extend the engine-owned trait history product with instance-based Chaos state:

```text
active curse instance
  acquisition identity
  complete selected pair payload
  clock kind
  initial count
  derived remaining count

matured blessing instance
  acquisition identity
  blessing identity, rarity, and exact processed payload
```

This is derived simulation history, not persisted mutable state. Selection
adds one active curse instance with its pending blessing. Each qualifying
event advances the matching active instances. Reaching zero atomically removes
that curse instance and appends the matured blessing instance at the same
checkpoint.

Mature blessings participate in later Chaos eligibility and chronological
trait history. They need not occupy ordinary boon equipment slots or collapse
repeated instances into one trait-key record.

### Existing checkpoints own every supported clock

Do not add a timing axis, depth-counter approximation, timer service, or Room
Timeline action.

Encounter clocks consume existing real `encounterCompleted` events:

- combat, miniboss, boss, Devotion, C-boss, and individual active Fields cage
  encounters count;
- Passive/story/noncombat presentation has no fake encounter use;
- optional challenge contacts do not silently stand in for the room's primary
  encounter; and
- `skipEndEncounterEffects` remains authoritative.

Advance and mature encounter-counted curses immediately after the exact
encounter completes and before later same-checkpoint reward, delivery, or
interaction settlement. The existing boss sequence remains:

```text
bossDefeated -> Judgment -> encounterCompleted -> possible Chaos maturity
```

Therefore Barren still suppresses Judgment when the boss encounter itself is
its final use; it matures only after that Judgment checkpoint.

Enshrouded consumes existing `roomExited`, including departure from the Chaos
room where it was selected. Capture the existing pre-exit Run State checkpoint
first; the next room observes any resulting maturation. Do not use
`biomeDepthCache` or `biomeEncounterDepth` as its clock.

Ordinary and Rejected consume one use after each successfully resolved
eligible Olympian or Hermes source screen. The source condition is
`GodLoot or TreatAsGodLootByShops`; a fallback-Gold result still closes that
eligible screen and consumes a use even though no god trait is equipped.
Devotion roles remain separate screens/checkpoints where the existing model
already represents them separately. The curse affects the offer before that
screen settles, then decrements afterward.

Expiring deliberately reuses the encounter clock with its rolled two-or-three
count and assumes success. The real 120-second timeout and 500-damage branch
are not modeled.

## Exact modeled consequences

### Creation

On maturation, add `+1/+2/+3/+4` of every element at Common/Rare/Epic/Heroic
through the existing element-history authority. Nothing is contributed while
pending. Repeated matured Creation instances stack and immediately affect
Infusion and later Chant eligibility.

### Favor

A matured Favor instance contributes its exact authored Rare roll plus fixed
`+0.10` Epic, Duo, and Legendary values to the existing immutable
`BoonRarityFacts` assembly. Multiple Favor instances add independently.

Do not persist a rarity ledger or a `Common disabled` boolean. Every later
offer derives the ledger from its provider/source facts, active Arcana, Proper
Upbringing, and matured Favor instances. Common becomes impossible only when
that final ordered ledger guarantees a later supported rarity.

### Ordinary

While active, Ordinary supplies one closed forced-Common offer fact at an
eligible Olympian/Hermes screen. It overrides fresh rarity selection for that
screen rather than mutating or persisting the rarity ledger. The complete
authored option identities remain intact; their rarities must be Common.

Apply the force before candidate/offer assessment, resolve the screen, and
then consume one Ordinary use. A retained non-Common option remains visible
and finding-backed for repair; it is not silently rewritten.

### Rejected

Extend the existing ordinary `AuthoredTraitOfferTraits` shape with one optional
exact blocked option key. All three generated options remain authored and enter
seen/history processing. While Rejected is active:

- exactly one option must be marked blocked;
- that option cannot be selected;
- that option cannot receive a Calling Card Rarify action;
- either other option remains selectable; and
- Vow of Denial still bans both unselected identities, including the blocked
  one, through its existing post-selection processing.

Missing, unexpected, or selected-equals-blocked states remain structurally
representable and finding-backed. Candidate artifacts publish whether a block
is required and which exact rows can receive it. React must not infer Rejected
from findings or reconstruct it from Run State.

When an eligible screen resolves as fallback Gold, the active curse use still
decrements, but there is no fabricated three-trait offer or blocked identity.

### Barren

Barren does not delete, rewrite, or spend authored Arcana state. Derive an
exact `barrenActive` fact from active curse instances and suppress the current
modeled Arcana consumers while it is true:

- Artificer capacity/availability;
- Judgment at `bossDefeated`; and
- Excellence, Divinity, and The Queen contributions to the boon-rarity ledger.

Existing spent-Artificer and Arcana-rank evidence remains unchanged, so the
same Arcana state resumes naturally when Barren matures. Do not expand this
slice into a speculative matrix of combat, health, magick, or unrelated Arcana
effects.

### Fully modeled traits with simulation-neutral effects

Every other selected curse and matured blessing preserves exact identity,
rarity, duration, eligibility, and its audited processed operands. They are
real catalog and authored traits, participate in strict codec/command
validation, enter pending/matured chronological history, appear in Run State,
satisfy later Chaos prerequisites where applicable, and retain the exact
identity/payload needed by the eventual game-plan consumer. They are not
omitted, collapsed into a generic unknown value, or represented only as display
text.

Only their currently unsupported gameplay effects are simulation-neutral. They
do not create partial damage, health, magick, money, resource, Death Defiance,
combat, door-preview, or timer models. This matches the planner's treatment of
other real traits whose identities and chronology matter even when their combat
effect does not.

## Catalog ownership

The Hades II catalog owns:

- one explicit acquisition-role-to-provider binding for `TrialUpgrade.self ->
Chaos`;
- the complete blessing and curse identity pools;
- labels and eligibility requirements;
- clock kind and legal duration domain;
- exact independently rolled operand descriptors;
- fixed/derived presentation values;
- pair-rarity rules; and
- the five closed semantic tags: Creation, Favor, Ordinary, Rejected, and
  Barren.

Add `chaos` to the normalized trait provider vocabulary without making it an
ordinary rarity-ledger provider. Keep Chaos pair construction in a focused
catalog product adjacent to traits. Ordinary trait offer pools, boon provider
bases, and `TraitGiverDeclaration` must not absorb Chaos-only pairing rules.

The normalized reward acquisition-role declaration gains the narrow explicit
trait-giver binding consumed by `traitGiverForAcquisitionRole`. The catalog
compiler must populate and validate this binding for every current
trait-producing acquisition role, including `TrialUpgrade.self -> Chaos`, and
the engine must retire the live `gameName.replace(/Upgrade$/, '')` discovery
heuristic. Do not replace that heuristic with a raw-name special case for
`TrialUpgrade` in the engine.

The catalog compiler validates the complete 17/16 closure, exact operand sets,
allowed tags, fixed rarity precedence, and the TrialUpgrade binding. The
planner engine consumes only the normalized product; it does not import Hades
declarations or switch on raw game table names outside the closed semantic
keys.

## Authored project and schema 51

This is a strict schema bump from 50 to 51 because every `TrialUpgrade` reward
now has a declaration-owned `self` trait child and the authored trait-offer
union gains the Chaos branch and optional Rejected block key.

Newly authored TrialUpgrade rewards default to:

```text
traitOffersByAcquisitionRole.self = null
```

That is a valid incomplete frontier. It publishes `traitOfferMissing`, remains
navigable, and can be repaired through the Chaos editor. The engine never
fabricates a random pair during defaulting, decoding, or unrelated commands.

The strict codec rejects unknown structural fields, impossible duration/value
domains, and impossible numeric shapes. Context-invalid but structurally valid
pair identities, rarities, prerequisites, and Rejected block choices decode
and remain repairable through candidate/finding products.

The existing `schema/migrate-project.js` gains an explicit 50-to-51 step:

1. require the exact schema-50/catalog-0.30 source contract;
2. traverse every concrete authored reward state;
3. add `traitOffersByAcquisitionRole.self = null` to `TrialUpgrade` rewards
   when absent;
4. preserve an already present structurally valid child;
5. update schema and catalog versions.

Do not infer or fabricate selected Chaos outcomes during migration.

The CLI remains a narrow JSON transformer with local structural checks. An
engine-owned migration test must pass the transformed output through the live
schema-51 catalog and strict decoder, then attest canonical re-encoding. Do not
package the TypeScript engine/catalog into the standalone migration utility or
duplicate codec policy in JavaScript.

Refresh all 14 readable checkpoint files and manifest hashes. Their current
semantic content has no TrialUpgrade and should change only in protocol
metadata. Add one named manifest-backed natural-Chaos checkpoint owning a
selected Chaos room, unresolved TrialUpgrade child, and ordinary continuation.
Focused tests derive authored-pair and later-clock variants through semantic
commands rather than adding several large snapshots.

## Engine simulation and candidate products

Keep the complete Chaos matrix in one engine-owned neighborhood, preferably a
focused Chaos module consumed by `simulation/traits.ts`, reward processing,
and candidate artifacts. It may define the pure pair assessment, Chaos history
fold, clock advancement, and effect projections. It must not become an ambient
service or generic trait-effect interpreter.

Reward settlement branches on `AuthoredTraitOffer.kind`:

- ordinary `traits` and `fallbackGold` keep their current path;
- `chaos` validates and records the selected pair, equips only its curse
  instance, and retains the blessing as pending; and
- no ordinary equipped-slot or ordinary giver logic is applied to the pending
  blessing.

Candidate artifacts reuse the existing exact `TraitOfferAddress` registry and
publish:

- eligible curse identities;
- eligible blessing identities against the same pre-pickup branch;
- legal shared rarities for the complete pair;
- legal duration and operand domains;
- complete-pair findings; and
- Rejected block requirements/domains for later ordinary offers.

Pin the currently authored invalid identity/value in repair domains. Do not
make React query declarations directly or calculate pair legality.

Run State extends the existing engine snapshot with a closed Chaos product:

- active curse instance and label;
- pending blessing and rarity;
- initial and remaining count with `encounters`, `locations`, or `god boon
screens`;
- exact processed payload summary; and
- matured Chaos blessing instances.

The app projects this product; it does not replay lifecycle history. Matured
blessings may also remain visible in the broader chronological trait history,
but the Chaos section owns pending/maturation visibility.

## Application and editor

Reuse the existing Trait Offer dialog, interaction binding, semantic address,
focus destination, Save/Cancel behavior, and one-command Undo path. A nearby
`ChaosOfferEditor` component is acceptable presentation decomposition, not a
new interaction framework.

The selected-pair editor is a compact progressive form:

1. curse identity;
2. rolled duration;
3. blessing identity;
4. shared rarity;
5. only the selected declarations' independently rolled numeric controls; and
6. a final complete-pair summary and engine feedback.

Changing an upstream field refreshes later candidate domains but does not
silently reroll or normalize retained values. Locally incomplete drafts stay
inside dialog state and are never dispatched. Save sends exactly one
`ReplaceTraitOffer` and creates one authored-history entry; Undo restores the
entire prior child.

Fixed/derived values such as Creation element count, Celerity movement values,
Chant per-Aether value, and Defiance's fixed effect render read-only when useful
and never receive fake sliders.

The Room Timeline launcher reads `Choose Chaos outcome` while missing and
`Edit Chaos outcome · <blessing>` when authored. It remains attached to the
required TrialUpgrade pickup row.

Later ordinary trait rows gain one compact mutually exclusive `Rejected`
control. A blocked row keeps its visible identity and rarity, while selection
and Rarify are disabled. Malformed selected/blocked overlap remains visible
with engine feedback and can be repaired by changing either exact choice.

No editor control performs a hidden second dispatch, infers active curses from
labels/findings, or stores modal steps in the project.

## Delivery gates and commit boundaries

### Gate A — catalog, authored protocol, and core Chaos history

Deliver one complete engine-owned vertical slice:

- normalized 17/16 Chaos declarations and TrialUpgrade binding;
- schema 51, strict codec, command support, migration script, checkpoints, and
  named natural-Chaos fixture;
- selected-pair assessment and exact numeric validation;
- direct and Echo-replayed TrialUpgrade settlement through the same reward
  child contract;
- instance-based active/pending/matured history;
- all three clock kinds over existing checkpoints;
- Creation, Favor, Ordinary, Rejected, and Barren semantics;
- candidate artifacts and findings; and
- engine Run State Chaos product.

This gate must not land catalog/schema scaffolding without the five required
semantic consequences. Intended commit:

```text
feat(chaos): model paired traits and maturation
```

### Gate B — workspace and editor integration

Deliver the existing-interaction adaptation:

- Chaos branch in Trait Offer dialog;
- exact candidate-driven progressive form and numeric controls;
- Timeline launcher/summary;
- Rejected row control and disabled selection/Rarify behavior;
- Run State Chaos section;
- exact focus/finding navigation; and
- one representative natural-Chaos product workflow with Save and Undo.

Do not copy the catalog or engine consequence matrix into React tests. Intended
commit:

```text
feat(planner): author and inspect Chaos outcomes
```

### Gate C — durable absorption and closure

After both implementation gates and their reviews are stable:

- update the owning design authorities and the Chaos audit's planner
  disposition without erasing source evidence;
- record exact implementation/review/validation results in
  `IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan;
- run one complete `npm run check`; and
- commit the docs-only closure separately.

Intended commit:

```text
docs(chaos): close paired trait implementation
```

## Primary test ownership

### Catalog

`packages/hades2-catalog/test/catalog/traits.test.ts` owns:

- exact 17-curse/16-blessing pool closure;
- identities, labels, eligibility, clocks, durations, and operand domains;
- all fixed/derived versus independently rolled distinctions;
- Revelation's two independent operands;
- Defiance/Barren rarity precedence;
- exact five semantic tags; and
- malformed missing/extra operand and illegal tag/compiler mutations.

### Authored model and migration

A focused engine command/codec owner beside existing trait-offer tests owns:

- schema-51 Chaos round trip;
- TrialUpgrade unresolved default;
- exact catalog acquisition-role binding with no engine name-derived fallback;
- whole-pair ReplaceTraitOffer and one-step Undo;
- exact numeric-key and domain rejection;
- repeated curse identity legality;
- context-invalid pair retention;
- optional Rejected block-key structure; and
- real schema-50-to-51 migration with unresolved Trial child; and
- direct and Echo-replayed TrialUpgrade children both using the same authored
  contract.

Fixture integrity owns exact checkpoint closure, canonical bytes, catalog/schema
metadata, manifest hashes, and the one named natural-Chaos artifact.

### Engine semantics

A focused `chaos-traits` simulation suite owns the complete matrix:

- one-frontier complete pair eligibility;
- pending blessing not equipped or prerequisite-eligible;
- repeated and overlapping curse instances;
- encounter, location, and god-screen clocks at exact boundaries;
- fallback-Gold screen consumption;
- boss Judgment before encounter maturity;
- Creation timing and stacking;
- Favor ledger guarantee/non-guarantee and stacking;
- Ordinary force/retained-invalid/expiration;
- Rejected visible blocked option, selection/Rarify exclusion, stale/missing
  repair, and Denial consuming both unselected identities;
- Barren suppression/restoration of Artificer, Judgment, and Arcana rarity
  contributions without state loss; and
- Expiring's encounter-count simplification.

Existing rarity, Arcana/Fear, reward-processing, lifecycle, and natural-Chaos
topology suites retain representative boundary contacts rather than duplicating
this matrix.

### Application and product

Focused app owners cover:

- exact workspace interaction/focus closure for TrialUpgrade.self;
- missing-child navigation into the Chaos editor;
- progressive pair editing and declaration-shaped numeric controls;
- fixed/derived values without sliders;
- one Save, one history entry, and exact Undo;
- Rejected row behavior driven by candidate products;
- Chaos Run State projection; and
- one manifest-backed natural-Chaos workflow from required pickup through later
  visible maturation;
- one focused Echo Reward Reward Reward replay of TrialUpgrade proving the
  replayed `self` child opens the same editor, settles the same pair, and starts
  its clock at the replay acquisition checkpoint.

Do not add another command-heavy full-route fixture or reproduce the complete
engine policy matrix in product tests.

## Verification routine

During each gate, run the narrowest owning lanes and focused files. Do not run
the full planner or repository suite after every adjustment.

Gate A final evidence:

- focused catalog and engine owner files while developing;
- `npm run test:catalog`;
- `npm run test:fixtures:check`;
- `npm run test:engine` once after review remediation;
- root typecheck, lint, format check, diff check, and build only if shared
  application wiring is touched.

Gate B final evidence:

- focused projection/editor/Run State/product witnesses while developing;
- `npm run test:planner`;
- `npm run test:contract` when the workspace contract changes;
- `npm run test:product`;
- `npm run test:ui`;
- root typecheck, lint, format check, diff check, and production build.

Gate C runs the single complete `npm run check` required for phase closure.
Record exact pass/failure totals truthfully; do not rerun a green complete gate
solely because the docs-only absorption record was appended afterward.

## Required retirement and explicit non-goals

Retire in the same implementation gates:

- `TrialUpgrade` as an effect-neutral direct loot result with no child;
- any ordinary-trait fallback path applied to the Chaos branch;
- any duplicated UI-side Chaos pair or Rejected eligibility logic; and
- temporary schema-51 migration-only helpers after the durable migration script
  owns the supported conversion.

Explicitly excluded:

- natural-Chaos gate, map, topology, or continuation redesign;
- probability simulation, RNG seeds, or reconstruction of the two unselected
  Chaos alternatives;
- generic trait-effect or numeric-slider DSLs;
- persisted curse counters or maturation coordinates;
- Expiring's real-time timeout, damage, or survival branch;
- health, magick, money, combat, resource, door-preview, or Death Defiance
  simulation;
- optional challenge encounters as curse clock events;
- Transcendent Embryo, Cherished Heirloom, Yarn, Wells, Shrines, or delayed
  Hermes delivery;
- Dream Dive/bounty authored inputs;
- partial Arcana-effect expansion beyond the existing current consumers; and
- compatibility decoding of schema 50 in production.

## Gate acceptance checklist

The plan is complete only when all of the following are true:

- every new TrialUpgrade owns one unresolved or authored Chaos child at the
  existing TraitOfferAddress, including Echo-replayed TrialUpgrade;
- every trait-producing reward role resolves its provider from the normalized
  catalog binding and the engine name-stripping heuristic is gone;
- schema 51 and the migration script preserve real schema-50 projects without
  inventing outcomes;
- the catalog closes all 17 curses, 16 blessings, exact operand domains, and
  pair-rarity rules;
- one selected pair is assessed atomically against one pre-pickup branch;
- active, pending, and matured Chaos instances are history-derived and support
  repeated identities;
- each clock consumes only its exact existing checkpoint and matures in the
  locked event order;
- Creation, Favor, Ordinary, Rejected, and Barren have direct engine witnesses;
- Rejected keeps three identities and Denial still consumes the blocked
  unselected identity;
- Barren suppresses current Arcana consumers without mutating Arcana history;
- malformed/incomplete state remains navigable and repairable;
- the editor dispatches one complete semantic command and Undo restores the
  prior pair;
- Run State exposes active/pending/remaining/matured Chaos state without app
  lifecycle reconstruction;
- no parallel address, command, candidate, reward, timing, or picker machinery
  remains; and
- closure absorbs durable knowledge and deletes this plan.
