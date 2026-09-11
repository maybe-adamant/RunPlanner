# Boon Rarity Offer Feasibility Plan

## Status and base

Status: **Locked**.

Planning base: `683a186bfa39bd1a3cbdfb680ab2d6adb4b4e2c7`.

The discarded Infusion presentation draft is not part of this plan. The live
worktree begins this delivery with documentation only.

## Objective

Make boon rarity authoring use the game’s complete reached offer frontier
instead of assessing each trait and rarity in isolation.

This fixes three connected defects:

1. Artemis, Athena, and Dionysus declare the game’s shop-aware god-trait flag,
   but the planner excludes their offers from ordinary boon rarity effects.
2. Non-priority offer positions roll against the eligible pool’s nonempty
   rarity buckets, while the planner currently checks only the proposed trait’s
   rarity domain.
3. Gorgon Amulet rank supplies an Athena source override; it is not itself the
   final rarity of all three rows.

The corrected engine product must be shared by complete validation, contextual
pickers, initial drafts, and **Start Over** drafts. An impossible rarity receives
its finding at the offer where it became impossible rather than causing only a
later symptom such as Uncommon Grace disappearing.

## Authorities

- [`BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md`](../audits/traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md)
  owns the source rarity algorithm, provider facts, Infusions, Gorgon, Proper
  Upbringing, Yarn, and override precedence.
- [`TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`](../audits/traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md)
  owns priority selection, ordinary fill, replacements, failed-rarity fill,
  Denial, exhaustion, and Fallback Gold.
- [`KEEPSAKE_GAME_DATA_AUDIT.md`](../audits/loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md)
  owns Gorgon’s lifecycle and identity-only authored child.

This plan does not restate those matrices. It specifies how the current code
must consume them.

## Current code gap

- `simulation/trait-offers.ts::boonRarityFactsForOffer` admits only provider
  kinds `olympian` and `hermes`; it ignores the normalized
  `shopAwareGodTrait` fact.
- `simulation/trait-authoring-policies.ts::assessTraitOption` calls
  `boonRarityRollUnavailable` with one trait’s supported rarities. It cannot
  account for the other eligible identities or the authored prefix.
- `simulation/keepsakes.ts::gorgonRarityForRank` stores a prematurely final
  rarity in pending Gorgon state. Encounter settlement then materializes every
  Athena row with that value through `freshRarityOverride`.

The existing ledger, trait composition path, candidate session, and Gorgon
candidate frontier are the intended extension points. No parallel rarity
service is needed.

## Locked decisions

### Reuse the existing offer path

Extend the existing boon rarity facts and trait composition calculation. Do
not add a persisted offer snapshot, a new application-facing rarity model, or a
second trait eligibility engine.

Structural identity eligibility is evaluated first using existing rules. The
rarity calculation then uses that eligible identity set and the authored
prefix. This separation may be an internal helper split, but it must remain one
engine policy surface to callers.

The game’s two fill paths remain distinct:

- a priority-selected identity rolls rarity against its own supported domain;
- a non-priority position rolls over the complete nonempty rarity buckets and
  removes the chosen identity from every bucket before the next position.

Existing replacement, high-tier, failed-rarity fill, Denial, exhaustion, and
Fallback Gold logic remains authoritative. The correction supplies rarity
feasibility to that composition; it does not rewrite it.

### Normalize only missing source facts

The catalog exposes the default boon rarity roll order once and an optional
giver override only where the source differs. It must not repeat the default on
every giver.

`shopAwareGodTrait` determines whether an NPC provider participates in
god-loot rarity bonuses. Provider base remains separate:

- Hermes uses the Hermes base;
- Olympians and shop-aware Artemis, Athena, Dionysus, and Hades use the
  ordinary boon base when their traits use boon rarity; and
- Hades remains rarityless and gains no rarity editor.

The ledger must support source-owned Heroic checks without making Heroic an
ordinary fresh rarity. Athena and Artemis use their declared custom roll
orders; Dionysus uses the default order intersected with its trait buckets.

### Preserve Infusion internals for now

Infusions retain their current internal persisted rarities. Four Common-only
Infusions occupy only the Common bucket; scalable Infusions occupy their
declared Common/Rare/Epic buckets. The existing failed-rarity fill and Denial
rules decide whether a Common-only Infusion can fill a later position.

Infusions remain excluded from Uncommon Grace rarity counts and continue to use
their existing Vow of Hubris rule.

No `Infusion` schema rarity, fixed label, hidden selector, or special editor is
included. Presentation is deferred until hidden values cannot brick authoring.

### Keep Gorgon identity-only

Gorgon keeps its existing authored shape: three Athena identities and one
selection. There is no per-row rarity authoring and no schema migration.

Pending Gorgon state retains its chronological source rank or rarity level,
not a final rarity. At the existing reached Gorgon candidate frontier, the
engine:

1. derives the sparse Athena source override from the existing Gorgon rank
   profile;
2. applies the shared rarity ledger and normal room/source precedence;
3. ignores temporary rarity bonuses at ranks II-IV, as the source does; and
4. chooses the lowest reachable rarity as one deterministic legal realization.

That one resolved rarity is passed through the existing Gorgon candidate and
used to materialize all three rows. Ordinary settlement then supplies Run State
and execution output; those consumers must not derive Gorgon rarity again.

Without a higher-precedence room override, the deterministic results are:

- rank I: Common, raised by any guaranteed permanent or eligible temporary
  contribution;
- rank II: Rare, with Epic still game-possible but deliberately not authored;
- rank III: Epic; and
- rank IV: Heroic.

This is an explicit planner simplification. The game rolls each row separately,
so rank-I/rank-II screens may naturally contain mixed rarities. Modeling those
mixtures would require per-row authored rarity and is outside this correction.

## Ownership

### Hades II catalog

`packages/hades2-catalog` owns the default/custom roll-order declarations and
compiler validation. The existing closed `gorgonAmulet` effect and rank profile
are sufficient for its focused engine evaluator; do not add a generic source
effect interpreter or speculative Gorgon configuration.

### Planner engine

`packages/planner-engine` owns:

- source-aware boon rarity facts, including shop-aware NPC providers;
- provider-order-aware numeric rarity checks;
- prefix-aware pooled rarity feasibility;
- exact option-owned `rarityRollUnavailable` findings;
- consistent complete offers, candidates, and draft generation; and
- one Gorgon rarity resolution at the reached candidate frontier.

`freshRarityOverride` remains for genuinely fixed sources such as Chaos
Ordinary and Echo replay. Gorgon stops using it as a shortcut for its source
chance ledger.

### Planner application

The application consumes the corrected engine candidates and findings. A
bounded projection adjustment is allowed only if an existing adapter assumes
rarity is prefix-independent. React must not calculate rarity buckets, provider
order, Proper effects, or Gorgon outcomes.

The executor and game module are unchanged; they continue to receive the final
validated trait rows.

## Delivery gates

### Gate A — Source-aware ledger

1. Normalize the default roll order once and only the source-specific
   overrides.
2. Admit `shopAwareGodTrait` providers while preserving the Hermes base and
   rarityless Hades behavior.
3. Extend the existing numeric ledger for the resolved source order and
   source-owned Heroic.
4. Prove override and modifier precedence remains unchanged.

Primary tests: catalog compiler and `boon-rarity` engine tests.

Commit: `fix(rarity): normalize boon source ledgers`.

### Gate B — Prefix-aware offer feasibility

1. Form the structurally eligible identity set without recursively invoking
   the old per-trait rarity decision.
2. Preserve priority-row assessment and evaluate remaining rows against the
   sequential nonempty pool buckets.
3. Feed the result into complete offer assessment, focused candidates, initial
   drafts, incremental drafts, and Start Over drafts.
4. Preserve existing replacement, high-tier, Denial, shortage, failed-rarity,
   and Fallback Gold authorities.

Primary tests: trait authoring/composition engine tests, plus one representative
application Start Over/picker witness if its adapter changes.

Commit: `fix(traits): evaluate rarity across the offer pool`.

### Gate C — Gorgon and closure

1. Replace pending final rarity with source rank/level.
2. Resolve Gorgon once through the shared Athena ledger at its existing
   candidate frontier.
3. Remove the superseded direct rank-to-rarity helper and stale assertions.
4. Review the combined diff against the three owning audits and confirm no
   application-side rarity policy was added.
5. Run one complete `npm run check` after narrow catalog, engine, and affected
   planner tests pass.
6. Fold any remaining durable invariant into its owning audit and delete this
   temporary plan.

Primary tests: existing Gorgon lifecycle tests with focused ledger contacts;
do not duplicate the complete rarity matrix in both suites.

Commit: `fix(keepsakes): compose gorgon rarity through the ledger`, followed by
a documentation-only closure commit only if needed.

## Acceptance witnesses

The combined implementation must prove:

- priority rarity remains trait-local while ordinary fill is pool-aware;
- selecting one identity changes the next position’s available buckets;
- Common-only and scalable Infusions follow their respective internal domains;
- the existing failed-rarity/Denial distinction remains intact;
- Infusions remain excluded from Uncommon Grace counts and unchanged under
  Hubris;
- Common Dionysus Worry Free is rejected under active Proper Upbringing at its
  own offer, while Rare is accepted;
- Artemis and natural Athena receive applicable permanent god-loot rarity
  bonuses, while Hades remains rarityless;
- Gorgon ranks I-IV follow the locked deterministic result, including permanent
  contributions and rank-I versus rank-II temporary-bonus handling;
- initial and Start Over drafts do not seed rows rejected by complete
  assessment; and
- stale authored rarities retain an exact option-owned finding.

Reuse existing tests for Proper activation, Yarn consumption, Denial bans,
replacement limits, high-tier composition, Infusion counts, Hubris, and Gorgon
lifecycle. Do not copy their complete matrices into new suites.

## Expected deletions and non-goals

Delete the Gorgon direct final-rarity helper and the per-trait-only rarity path
that the pooled assessment supersedes. Do not create compatibility paths.

Explicit non-goals:

- RNG replay, seeds, probability normalization, or percentages;
- persisted rarity ledgers, pool snapshots, schema changes, or migrations;
- Infusion presentation changes;
- per-row Gorgon rarity authoring;
- a generic catalog effect interpreter;
- provider-name switches in the planner engine;
- replacement, Denial, Fallback Gold, or high-tier redesign; and
- executor or game-module changes.
