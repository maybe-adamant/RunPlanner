# Contextual Editor UX

## Purpose

This document owns contextual selection across the F/G/H/I and N/O/P/Q
editors and the popup editors that host it: which values a picker offers,
how it explains them, and how drafts commit. It keeps room and reward
authoring context-aware, compact and deliberate without taking over
authored-project, simulation, validation or semantic-command authority.
[Editor Model](EDITOR_MODEL.md) owns projection, binding, query caching and
findings; [Structured Editor Workspace](STRUCTURED_EDITOR_WORKSPACE.md) owns
where these controls appear; [Candidate Evaluation](CANDIDATE_EVALUATION_MODEL.md)
owns candidate-session preparation, domain evaluation and replay scope.

## Product Contract

At every contextual selector, the editor should answer:

- which values can occur at this exact game decision point;
- whether any value is required by the current support set;
- why an unavailable value cannot occur;
- whether the simulator lacks enough upstream history to make a claim;
- whether the currently authored value has become invalid.

The editor helps the user choose a possible plan. It does not optimize for
probability, automatically repair authored state, or silently replace a value
that became invalid after another edit.

## Ownership

```text
simulation candidate assessment
  -> application presentation policy
  -> contextual picker projection
  -> React interaction
  -> one semantic command
```

The simulator owns game facts: candidate and force support, exact exclusion
reasons, counter values and declared ranges, creation and appearance counts,
reachable reward-store and counted-bag states, peer reward and source
conflicts, and evaluation coverage. Candidate evidence preserves exact
ownership and distinguishes unavailable coverage, upstream incompleteness,
upstream invalidity, requirement failure, store exclusion, bag depletion, peer
conflict and source exclusion. Concrete reward proposals continue through the
selected-plan reward authority.

The application presentation layer maps typed simulation facts to the common
contextual option vocabulary and owns ordering and grouping, room-category and
Devotion-pair aggregation, ordinary versus diagnostic visibility,
player-facing reason text, selected-invalid retention and compact summary
values.

React owns accessible interaction and transient picker state: search,
disclosure and partial payload progress, all outside the authored project. It
does not reevaluate requirements, bags, force pressure or sibling legality.

## Progressive Evaluation Input

Frontier guidance uses the same progressive coverage and candidate evidence as
selection; ordinary-decision, takeover Preboss, I mixed-batch, completed-Hub
and width-one Preboss behaviours do not collapse into one action.

Contextual selectors consume addressed candidate capabilities from the single
project evaluation defined by `SIMULATION_AND_VALIDATION.md` and
`CANDIDATE_EVALUATION_MODEL.md`. A selector is assessed only when progressive
coverage reaches its semantic pre-decision point. Earlier covered controls keep
their evidence; the repair owner at the authoring horizon keeps its capability;
later owners remain visible but unassessed.

A complete-valid route prefix seeds the active biome. Required upstream
incompleteness locks the downstream authoring suffix, while invalid authored
input remains editable for repair. The application does not manufacture a seed
from defaults, partial history, or hypothetical completion, and it does not
replay simulation to recover candidate facts beyond the published horizon.

A downstream biome receives no contextual claim until every prior biome on its
route is complete and valid, and an incomplete active biome publishes support
for every covered decision without a canonical snapshot; a missing downstream
decision or Preboss does not block earlier selectors. N's joint Hub board and
ordered traversal publish coverage by semantic region rather than rendered
slot order. Decision indexes and rendered rows are presentation only. Only
semantic addresses identify candidate inputs, coverage, and findings.

## Shared Candidate Language

The simulation-level vocabulary remains equivalent to:

| State                         | Meaning                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `possible`                    | At least one reachable game state supports the proposed value         |
| `forced`                      | The current support set requires this candidate or candidate family   |
| `impossible`                  | No reachable state in the evaluated context supports the value        |
| authored prerequisite missing | A required pool, Fields roll, or biome outcome must be selected first |
| other unavailable context     | The semantic pre-decision context was not reached for another reason  |

Unavailable context is not candidate invalidity. A missing authored
prerequisite names its exact semantic owner; other unavailable states retain
their coverage or upstream evidence. The editor must not color or filter a
stable declaration domain as though it had been evaluated when the simulator
could not reach that owner. An authoring launcher whose context is unreached is
disabled and carries no explanation beyond "Waits on an earlier choice"; the
frontier finding owns the explanation. An unevaluated candidate is not
authorable in a native select, radio or checkbox: an unreached setting is
disabled on render with that hint while its retained value stays
visible, and its candidates still load only on interaction. Decision-entry
pickers keep their own rule: an ordinary target or an uncommitted Hub stays
authorable before evaluation, while a takeover or a persisted Hub envelope
requires evaluated support. Every hint renders through the one shared hint
layer, beside the pointer on hover and beside the control on keyboard focus,
and the same text leads the control's accessible description.

### Selected-Value Invariant

A currently authored value is never hidden.

If an upstream edit makes an authored room, reward, or payload impossible, the
editor retains it, presents the exact reason, and permits an explicit
replacement. Only an owning structural deletion may remove it without a
replacement.

Room replacement retains declaration-bounded compatible room-local leaves
before this contextual policy evaluates their new simulation context. The
picker does not decide leaf compatibility or reset retained values; that is the
authored-model command contract.

### Ordinary and Diagnostic Presentation

The ordinary picker emphasizes supported authoring:

- forced values appear first under `Required now`;
- possible values appear under semantic categories;
- unselected impossible values are absent from the ordinary list;
- a selected impossible value remains pinned and visibly invalid;
- unavailable context leaves the stable domain editable but clearly
  unassessed.

An `Unavailable` disclosure may expose impossible values with their reasons.
These entries are inspectable but not selectable, keeping ordinary choices
compact while preserving on-demand diagnostic evidence.

The application projects the ordered picker sections (required, semantic
categories, unassessed, unavailable) before React sees them. The shared
component mechanically renders those sections, manages search and focus, and
opens the unavailable disclosure; it does not decide category order,
required-first policy, selected-invalid pinning or ordinary-versus-diagnostic
visibility from raw candidates.

## Context-Aware Room Selection

### Room Exclusion Families

The current room generator exposes these exclusion families:

| Simulation reason              | Game meaning                                                      | Ordinary presentation                                      |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `notCandidate`                 | The declaration is outside this biome generation domain           | Omit                                                       |
| `physicalExitUnavailable`      | The addressed physical exit does not exist                        | Do not render an active selector for that exit             |
| `exitIncompatible`             | Source/exit structure rejects this target                         | Omit; retain and explain if already authored               |
| `currentRoomRepeat`            | The game cannot immediately repeat the current room               | Omit; retain and explain if already authored               |
| `forceMinimum`                 | A forced declaration has not reached its minimum counter boundary | Omit; expose as `not yet available` diagnostically         |
| failed eligibility requirement | A declared current-run requirement rejects the room               | Present from its typed failure, not one opaque reason      |
| `maxCreationsThisRun`          | Prior generated occurrences exhausted the run-wide creation cap   | Omit; show the current and maximum counts diagnostically   |
| `maxCreationsPerRoom`          | This predecessor exhausted its parent-local creation cap          | Omit; identify the parent-local exhaustion                 |
| `maxAppearancesThisBiome`      | An entered occurrence exhausted the biome appearance cap          | Omit; show the current and maximum counts diagnostically   |
| `forcedPool`                   | A required forced pool excludes otherwise eligible rooms          | Show only supported forced candidates under `Required now` |

The exact modeled caps are `MaxCreationsThisRun`,
`MaxCreationsPerRoom`, and `MaxAppearancesThisBiome`. Presentation must not
collapse creation and appearance histories into a generic uniqueness message.

`physicalExitUnavailable` also obeys downstream retention. An absent,
unauthored physical exit receives no active selector; a previously authored
target retained after capacity shrink remains visible as unavailable until an
explicit repair or structural deletion removes it.

Reachable blank exits follow physical generation order. The first blank exit
whose predecessors are concrete owns a contextual picker immediately; it does
not require an arbitrary placeholder room before support can be shown. Later
blank exits remain visible but inactive with a short `Waiting for prior exit`
status. Selecting the current exit advances the same progressive simulation
frontier and activates the next picker. This mirrors one-by-one game door
generation and avoids guessing over unknown same-batch peers.

### Structured Requirement Failures

An `eligibilityRequirement` reason retains the failed normalized requirement
and its concrete evidence so contextual explanations do not depend on a coarse
reason code alone. Encounter candidates likewise retain failed preparation
requirements with actual depths, encounter counts and spacing, reward identity,
and room tags. The picker presents every distinct failed condition without
reevaluating it. Alternative native definitions remain alternatives within one
authoring profile; a supported variant produces no exclusion for that profile.
Phase activation and consumed Gorgon exclusions retain their distinct reasons.

A counter-range failure identifies its counter axis (including
`biomeDepthCache` and `biomeEncounterDepth`), the actual value and the
expected range.
This is a general requirement-evidence contract. `biomeDepthCache` is a
high-value consumer, not a UI special case. The same policy can distinguish:

- not yet inside a minimum boundary;
- past a maximum boundary;
- an unmet history predicate;
- a failed creation, appearance, reward, or encounter condition.

### Force Presentation

Required force pressure matters to ordinary authoring and receives the
`Required now` group. Optional force pressure does not make a merely possible
room more or less valid in this possibility simulator and does not need a
prominent ordinary badge.

## Grouped Room Picker

Room kind is navigation, not authored or session selection state. One grouped
picker selects the concrete room directly.

One accessible searchable picker groups concrete room labels:

```text
Required now
  Preboss

Combat
  Combat 03
  Combat 06

Miniboss
  Shadow-Spiller

Unavailable
  Combat 01 — appearance cap reached
```

Olympus groups ordinary room choices by their declared Indoor/Outdoor tags
instead of room kind; dual-tagged Preboss stays a separate category. These
headings describe the destination room, while picker-only suffixes such as
`(1I/1O)` describe its outgoing doors. Required and unavailable sections retain
the shared presentation policy.

The category projection follows its concrete children:

- zero supported children: omit the category from the ordinary list;
- one supported child: present that concrete room directly with one explicit
  selection;
- several supported children: group them without requiring a prior category
  mutation;
- a retained invalid selection: pin it even when its category otherwise has
  no supported children.

Selecting a category must never implicitly author its only child. Choosing a
concrete room remains the user intent and dispatches one semantic command.

Once an occurrence has a room, its selector has no empty replacement. The room
may be replaced, or the occurrence may be removed through an explicit owning
structural command.

## Resolved-Store-Aware Rewards

A reward editor consumes the exact resolved store at its offer point. Its
ordinary reward-type domain must not remain a union of every store that the
template could theoretically use.

Examples:

- a RunProgress offer does not present Ashes as a supported choice;
- a MetaProgress offer does not present Max Health as a supported choice;
- a declaration-forced store applies even when the parent batch uses a
  different authored base store;
- fixed Story, Shop, wheel, cage, side-room, and Goal/NonGoal producers retain
  their declaration-owned store semantics.

Changing a parent batch store retains every authored child reward. A now-
unsupported child remains visible and invalid until replaced. The editor never
repairs child rewards as a side effect of changing the parent store.

## Joint Sibling Reward Awareness

Generated siblings share physical offer order, peer-duplicate rules, Boon
source rules, Devotion projection, and counted-bag mutation where declared.
Every reward candidate must therefore be assessed against the current authored
sibling set rather than in isolation.

Examples include:

- Max Health on Exit 1 can make Max Health unavailable on a later exit;
- a Boon source already used by an earlier sibling can make that source
  unavailable later;
- a Devotion source pair participates through its complete concrete payload;
- an earlier physical offer can deplete a counted-bag entry before a later
  sibling is evaluated.

The explanation identifies the conflicting semantic sibling in player-facing
language, such as `Already offered on Door 1`. It does not expose occurrence
IDs or finding codes.

Changing an earlier sibling may invalidate a retained later reward. The later
reward remains authored; sibling awareness guides repair but does not perform
it.

## Counted-Bag Awareness

Counted-bag state should affect the candidate picker before the user authors an
impossible reward. An unavailable candidate distinguishes at least:

- outside the resolved store;
- excluded by a bag-entry requirement;
- depleted from every reachable bag state;
- blocked by a jointly generated peer;
- blocked by Boon or Devotion source support.

The simulator models possibility and may preserve several reachable latent
bag states. The ordinary UI therefore must not invent a deterministic
`remaining / total` counter when no single remaining bag exists.

A safe compact summary is based on candidate support, for example:

```text
Major Reward · 6 reward types currently supported
```

An optional diagnostic disclosure may explain unavailable entries and whether
a possible reward is supported by at least one reachable bag state. Exact bag
branches remain simulation evidence, not ordinary editor rows.

## Compact Compound Reward Picker

Reward type and payload form one semantic value and should use one compact
control while closed:

```text
Reward  [Boon · Apollo]
Reward  [Devotion · Apollo / Poseidon]
Reward  [Max Health]
```

Opening the control starts one transient interaction:

1. selecting a payload-free reward commits immediately;
2. selecting Boon advances within the same popover to one God picker;
3. selecting Devotion advances to the chosen-God picker and then the
   spurned-God picker;
4. the complete `ResolvedRewardOffer` is committed only when every required
   payload value exists;
5. cancelling leaves the authored reward unchanged.

The project never stores an incomplete reward or temporary payload. Transient
picker progress is UI-session state and does not enter undo history.

For Devotion, first-source presentation is derived from complete pairs:

- a first source is supported when at least one supported second source can
  complete it;
- after the first choice, the second picker evaluates concrete complete
  pairs;
- the same resolved-store, sibling, source, and bag constraints apply at both
  steps.

The final replacement is one semantic command and one undo entry. Editing only
an existing payload may open directly at the relevant source step while still
committing one complete replacement.

The closed control occupies one row; its popover may use more space without
expanding every room card.

## Shared Contextual Picker Projection

Room and reward controls share a presentation vocabulary without sharing
domain rules. A projected option carries its value, label, optional category,
a state of forced, possible, impossible or unassessed, whether it is selected,
and an optional explanation. This is application/UI vocabulary: it does not
replace the richer typed simulation assessment or enter persisted state.

The application projection bridge implements this vocabulary. It consumes
typed candidate evidence, preserves the richer
engine result, and maps unavailable addressed coverage to `unassessed`. The
grouped room picker consumes the ordered model. Counted reward editors
consume a producer-resolved type domain and one application-owned relational
payload domain. That domain evaluates complete offers through the existing
possibility frontier, aggregates Boon and Devotion source choices over concrete
witnesses, and retains selected-invalid values. A projected option keeps both
the exact authored offer evaluation and an aggregate supporting witness: a
Devotion source replacement therefore preserves the other authored source even
when another pair is what proves aggregate support. Relational assessment yields
between candidate simulations so opening or hovering a dense Devotion domain
does not monopolize one browser interaction task. Semantic sibling evidence
identifies the conflicting Exit, cage, wheel offer, side room, or Hub room
without exposing occurrence IDs.

The ordered picker model keeps one presentation-policy authority while room
and reward controls share one accessible component. That component supports
grouped and searchable values, an inspectable unavailable disclosure,
selected-invalid pinning, keyboard traversal and typeahead, automatic
continuation between compound payload steps, one completed intent per
semantic command, and stable option projections rather than domains rebuilt on
every draw.

### Control selection policy

Use the contextual picker for a domain identity when search or semantic
grouping is useful, run context can require or exclude values, individual
explanations matter, a retained invalid value needs a repair path, or the
interaction is staged or compound. The application owns its complete picker
model; React owns accessible presentation and dispatch only. Rarity therefore
remains contextual despite its small domain because concrete rarity variants
carry candidate evidence and retained-invalid repair.

Use a native select for a small, flat, closed scalar parameter of an already
identified object when no search, grouping, explanation, or rich repair state
is needed. Candidate backing alone does not require a popover: the compact
`CandidateSelect` remains appropriate for reward pool or store, Fields roll,
Ephyra generation, reward-wheel parameters, and Ship combat phase count.
Counts, ranks, delivery delays, insertion order, weapon or aspect, and other
closed enums follow the same scalar rule. A candidate-backed scalar keeps its
complete declaration-owned domain visible after assessment. Engine-impossible
values are disabled and labeled unavailable rather than disappearing, so a
forced rule remains distinguishable from a smaller structural domain.

Stable room-feature identity domains may use the contextual presentation even
when no focused simulator query exists. The application must then expose the
declaration-owned domain as unassessed, not fabricate support. Once the owning
feature is assessed, a selected declaration identity excluded by that evidence
remains pinned as invalid for repair. Opening a contextual selector stays a
lazy query boundary wherever a real candidate query exists.

## Popup Editors

A popup editor keeps a local draft and saves once when it edits one atomic
authored value whose intermediate states are not meaningful plans (trait
offers and their nested outcomes, Pom, Anvil, Judgment, Crystal Figurine,
Path of Stars). Otherwise each control commits immediately (encounter
customization, Loadout Arcana and Fear, Hub room popover, keepsake equip
results). A nested editor saves into its parent draft; only the outer Save
commits.

Every popup editor uses one dialog shell: a title, the always-mounted
[feedback region](EDITOR_MODEL.md#inner-layer-and-stable-rows), and a footer
with Cancel and Save for drafts or Done for live editors; Escape is Cancel or
Done, and an open nested picker is dismissed before its dialog. Initial focus
lands on the exact repair control, else the first enabled control; focus
returns to the launcher after close. A draft editor's open state lives in the
editor session; its draft is replaced when the authored value changes and
kept when only context changes; it closes when its owner leaves reached
context; and history shortcuts are off while it is open. Its feedback region
reflects the draft through the engine's draft assessment and matches the
launcher at rest. A reset that only clears the draft is distinct from one that
commits a reset to unresolved or to the default.

Trait, Hex, Chaos, Pom, Anvil and Path of Stars launchers share one label
form, `{Verb} {kind} · {value}`: the chosen trait or Hex, the Pom target and
its levels, or the Chaos curse and blessing; Anvil and Path of Stars name no
value, and the Path summary lists the screen's talents with repeats counted.
The full summary is the launcher's hint, an unset launcher says so, and
findings mark a launcher only with the shared finding mark. The application
projection supplies label and summary.

The selected trait outcome shows one labelled row per real choice, without
repeating the trait name. A secondary effect such as Concave Stone gets its
own block after the pick, with its granted trait's follow-ups nested under its
grant. A grouped outcome (All Together sets, Natural Selection first-pass
order) holds partial picks in its rows and enters the draft only as a complete
engine-published value, so a partial group never enables Save. Row choices,
gating and resulting values come from the engine.

## Trait Offer Domains

Each materialized trait-option card uses that same contextual-picker
vocabulary for its trait and, when the giver's catalog policy is selectable,
rarity. Olympian and Hermes drafts allow zero to three cards; zero is the existing
Fallback Gold outcome, not an empty persisted trait list. Other supported
givers retain their declaration-owned shape.
The application prepares declaration- and schema-compatible concrete
`{ traitKey, rarity }` variants and evaluates them lazily through the exact
trait-offer interaction. React passes the complete local outcome and focused
option key to the bound interaction; it never constructs engine queries or
evaluates trait rules.

Infusion rows (the catalog's native `UnityTrait` members, including Chaos
Chant) retain concrete rarity authoring but display `Infusion (C)`,
`Infusion (R)`, and so on; accessible option names spell out the tier.
Their effective-rarity summary displays `Infusion`. Common-only rows use the
same fixed-value presentation. These labels never change stored values,
candidate support, or the ability to repair an unavailable rarity.

The trait picker aggregates concrete variants by trait. A trait is available
when at least one visible rarity is supported, unassessed when exact lifecycle
coverage is unavailable, and unavailable only when every visible concrete
variant is impossible. The selected invalid value remains pinned for repair.
Changing traits retains the current rarity when that concrete variant is
supported, otherwise selects the first supported declaration-ordered repair.
When the domain is unassessed, the exact current concrete value remains the
first choice when applicable, followed by the first declaration-ordered
unassessed variant. The rarity picker reuses the already evaluated concrete
batch. Fixed-rarity givers retain their authored rarity without a picker;
rarityless NPCs and Hammers expose no rarity control or label. Heroic remains
hidden as a fresh technical probe and appears only for a retained authored
value or an engine-supported Epic-to-Heroic replacement.

Add option and Remove last option form one compact action row outside the grid.
For ordinary Olympian/Hermes drafts they are always present and obey structural
limits: Add is disabled at three rows or when no unused individually eligible
identity remains; Remove is disabled at zero. Removing the last row means
Fallback Gold, and adding from Gold restores one row. There is no separate
Gold button. A short or Gold draft may be invalid; complete-offer feedback
explains why while the repair controls remain usable.

The focused picker does not filter by whole-screen composition. Individual
eligibility and duplicate identity still apply; the generation finding belongs
to the complete draft. Save requires that complete assessment and active child
detail to succeed. Start over requests an engine-supported initial outcome
instead of having React fill buckets or silently repair retained authorship.
Gold renders no option-local rarity, target, Circe or Death Defiance controls.

Echo's Boon Boon Boon uses the same trait form, option rows and selected-payload
editors with a distinct typed binding. Its provider-per-row identity and cached
rarity remain separate from ordinary fresh offers; effective granted rarity is
displayed without importing ordinary Rarify, Rejected or replacement controls.
Its local draft may contain one to three rows, including incomplete rows. The
engine supplies Add option and Remove last option transitions: addition requires
another distinct identity, removal preserves the retained prefix and clamps a
removed selection to the new final row. Completion still resolves through the
nested Echo owner and the parent complete-offer boundary, not a synthetic
standalone offer. Shared payload editors own prefix editing and cancellation;
each binding supplies its exact domain, finding identity and completed update.

A declaration-owned targeted option adds one target picker backed by the exact
trait-offer capability. It uses the same lazy boundary and catalog labels as
the trait picker; it does not inspect equipped history in the application or
switch on giver and trait names. A missing or stale selected target remains
pinned for repair, and the complete draft cannot be saved until the engine
supports that exact target.

Opening one picker is the deliberate evaluation boundary; static workspace and
dialog rendering perform no focused trait queries. Query caching and its
bounds are [application contracts](EDITOR_MODEL.md#drafts-and-contextual-queries).

Trait and rarity changes remain local modal edits. The complete-offer candidate
continues to own the consolidated feedback and Save support, and Save dispatches
one complete semantic replacement command. Escape dismisses an open nested
picker before it dismisses the containing trait dialog, preserving the local
draft and restoring focus at each boundary.

Concave Stone follows the same local-draft boundary. Its optional proc checkbox
starts unchecked: absent authored detail means no proc, including when an upstream
edit makes Stone available to an existing offer. A required proc still needs its
residual selection. Toggling or clearing Stone never
dispatches a separate child command before the complete offer is saved.
The Stone section presents its chance, activation checkbox, and unpicked-boon
target in that order. Any target-owned controls appear beneath that picker,
inside the Stone section rather than beside the primary acquisition's controls.
Inactive Stone hides those controls without deleting retained payloads.

### Trait dialog presentation

The shared trait dialog keeps effective rarity and effective level in a stable
summary for ordinary options, with an inapplicable value shown as a dash
rather than changing the card. These are engine-derived values, not
UI-calculated levels or rarity. Echo's shared rows likewise display their
engine-derived granted values rather than assuming ordinary fresh-offer
bonuses; its large mixed-giver picker uses trait labels without redundant god
prefixes.

Selectable rarity uses its contextual picker; fixed Duo/Legendary rarity is
read-only. Engine-supported replacement annotations show the exact prior
trait, slot and promoted rarity without React deriving the transition. Rarity
checks and replacement chance may appear in a read-only Offer State disclosure
as branch-correlated engine facts, not normalized outcome probabilities or a
global rarity ledger.

Selected child controls follow the live draft immediately. Targeted traits use
the shared target picker; Natural Selection uses one ordered compound result;
Circe uses the engine-provided Arcana or Vow domain. Loadout, Circe, Judgment
and Figurine share artwork cards and accessible dialogs, not selection policy.
Loadout changes apply immediately; effect dialogs keep a local selection until
Save, and Close discards only unsaved changes. Arcana cards show rank and
selection; current ranks come from the exact engine context, selected effect
targets preview the granted rank, and branch-varying ranks are not collapsed
to one. Ransom effects have a read-only preview, not invented authored
targets. A missing or stale selected child remains repairable and prevents
saving the incomplete outcome.

### Hex tree and Path of Stars

A normal Spell Drop uses the shared three-row rarityless editor as Edit Hex.
Position-owned Moonglow/Path bonuses remain per-row metadata, and the selected
spell's Hex tree is editable from the initial live draft: a layout picker over
the tree drawn on the native talent grid. Each editable node is its own picker.
A Rare or Epic node lists its pool and marks a talent another node holds. A
Common node offers swaps within its column (with the node holding that
talent), trades with its deck's talents in other columns and, in the partial
last deck, swaps for an unused talent; every Common edit keeps a legal tree
legal. A Common decks table below the board lists, per deck and Common
column, the talents that deck dealt there; each entry also opens its node's
picker, and a tree no deck sequence deals says so instead. The node being
edited and the other node an option involves are marked; these relations are
projected, not derived in React. God Sent nodes are fixed. Choosing a layout
generates its default tree, and Reset to default restores it. An edit is kept
as made: a tree-wide conflict is reported in the dialog feedback and marks its
nodes, with no save-and-reopen step. Both tree dialogs explain how Common
nodes are dealt. Aspect of Selene instead edits its Sky Fall tree in a loadout
draft dialog whose launcher carries the tree's finding; a later Path
acquisition does not expose a false replacement spell editor.

Each Path of Stars reward, and the Spell Drop that Aspect of Selene routes to
the tree, carries an Edit Path of Stars launcher beside its acquisition's other
editors once its screen is reached; a screen whose context is later lost keeps
its launcher, disabled with the waiting hint. Its draft dialog draws the plain
tree on the same grid: nodes invested on earlier screens are filled, this
screen's nodes are highlighted and removable, nodes the engine says can be
added are clickable, the rest are inert, and God Sent appears only once
inserted. A points counter heads the board. Nothing is preselected: a reached
screen without a choice opens at zero points and its required-choice finding
marks the launcher. The screen's points are a budget like a trait offer's
slots: once spent no node can be added, while removal always stays possible.
Removing a node a selected dependant needs is allowed; the draft feedback then
names the cut-off nodes and the wrong count, the cut-off nodes carry the
finding mark, and a saved conflict marks the launcher.

### Automatic outcomes

Automatic Steady Growth and Embryo outcomes appear at the timeline point where
their [cycle lands](TRAIT_OFFERS.md#timed-outcomes) with bound target
controls, not draggable author-created effects. Immediate keepsake targets
stay at their exact equip owner. Progress, rarity and
magnitude come from engine products; React does not advance clocks or infer
those values. Embryo magnitude edits keep the active slider and its focus
across candidate refreshes; updated values and their numeric domain appear
together, without briefly removing the control or retaining another binding's
domain.
