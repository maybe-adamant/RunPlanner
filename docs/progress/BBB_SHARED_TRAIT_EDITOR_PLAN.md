# Shared trait editor for Boon Boon Boon

## Status and objective

Status: locked and approved; slice A is next.
Base: `2b1f30b5`.
Evidence: `docs/investigations/BBB_SHARED_TRAIT_EDITOR.md`.

Render ordinary trait offers and Echo's Boon Boon Boon (BBB) through one trait
form, including selected payload editors and existing add/remove controls.
Remove BBB's parallel UI without treating its cached outcomes as fresh offers.
Commit the approved contract before implementation.

## Scope and authority

This is an application/UI consolidation with one bounded engine draft-policy
addition. No new game facts are inferred. The chosen UX simplification is that
BBB removes only its final row, like the ordinary editor.

- Engine: retain BBB's source-resolved domain, rarity, distinctness, completion
  and nested authored ownership. Own its supported next/previous-size draft
  transitions beside the existing Echo draft helpers. Ordinary exhaustion rules
  remain unchanged.
- Application: bind each typed draft to common row/picker/action/feedback
  presentation. Keep engine queries and complete commit destinations distinct.
- React: one trait-form rendering path and one editor per payload family;
  transient picker and compound-prefix state remain local.
- Catalog, persistence schemas, simulation effects, execution publication and
  game module: unchanged.

Authorities: `docs/design/ARCHITECTURE.md` (Product Construction, Reorganization
Contract, application/UI ownership); `docs/design/CONTEXTUAL_EDITOR_UX.md`
(trait domains, lazy queries, compound drafts and Save); and
`docs/design/AUTHORED_PROJECT_MODEL.md` (option-owned outcomes, Echo nested
ownership and Stone residual ownership).

## Locked design decisions

### One form, distinct typed bindings

Reuse the ordinary editor's visual structure, not its ordinary-only assumptions.
`TraitOfferEditorShell` currently interprets raw candidate results and
`TraitOfferOrdinaryOption` builds ordinary authored edits. Move only the parts
needed to let the same rendering consume a BBB binding.

The common form needs these bounded inputs:

- row identity/control IDs, trait and rarity picker capabilities, selected state,
  fixed/display values, and bound edit callbacks;
- optional supported controls such as Rarify, Rejected, Persephone and Hex
  metadata, without inferring support from a provider name;
- selected-payload bindings for shared target, All Together and Natural Selection
  editing, preserving exact finding owner and complete local draft;
- bound next/previous-size actions, existing ordinary recovery/fallback actions,
  feedback and completion/Save state.

Keep this contract application-owned. The form must not construct semantic
commands, decode raw simulation unions, or require an `AuthoredTraitOffer` just
to render a row. Ordinary and BBB controllers retain their actual draft types;
do not introduce a persisted common draft, synthetic giver, synthetic standalone
BBB offer address, or fake ordinary candidate result.

Shared payload editors own the same transient prefix/cancel/complete workflow
for every carrier. Bindings supply candidate loading and value updates. Sharing
only CSS or `CompoundOutcomeEditor` while retaining duplicate workflow code is
not completion.

### Reuse the existing size controls

The common controls remain **Add option** and **Remove last option**, invoking
the next-size or previous-size draft supplied by the binding.

- Ordinary: retain `nextOptionalHighTierTraitOfferDraft` and
  `previousOptionalHighTierTraitOfferDraft`, including candidate approval of
  removal. Do not loosen exhaustion policy for BBB's benefit.
- BBB: support local drafts of one to three rows. Addition appends an empty row
  when the existing engine domain permits another distinct identity; no need to
  settle all current rows before changing size. Removal drops only the final
  row and is allowed even when that row or another row is incomplete/invalid.
- Preserve retained rows and their payloads. Preserve selection when it remains;
  if the selected final row is removed, select the new final row, matching the
  ordinary previous-size behavior. No zero-row draft.
- The engine supplies these typed draft transitions. Use the existing Echo
  draft/domain neighborhood; no generic resizing service or persisted command
  is needed. React does not duplicate eligibility or size policy.

Local draft editability is not whole-offer validity. Existing BBB semantic
checks still determine whether a completed nested offer can be accepted.
Blank rows must never be cast into complete authored rows or passed to codecs.

### Preserve carrier-specific meaning

BBB trait identity includes its provider; cached rarity and effective granted
rarity remain distinct. It must not gain ordinary fresh-roll, replacement,
Rarify, Rejected, Stone, Persephone or Offer State behavior merely through reuse.
Expose only capabilities actually supported by its current engine product.

Retain the BBB nested loader/back/save destination and parent complete-offer
persistence behavior. The common form may have a small ordinary controller and
a small BBB controller. It must not contain scattered `isBBB` branches.
Keep Chaos's dedicated presentation; this is not a rewrite of every reward UI.

## Delivery slices

### A — Make the existing trait form reusable in place

Starting contacts: `TraitOfferEditorShell.tsx`, `TraitOfferOrdinaryOption.tsx`,
`TraitOfferSelectedOutcome.tsx`, `TraitOfferSelectedSpecialOutcomes.tsx`, and
`projections/structured-workspace/contract.ts` / `interactions/trait-offer-interactions.ts`.

Implement the narrow common presentation boundary with the ordinary editor as
its live consumer. Separate ordinary binding responsibilities only as needed.
Share target and compound editor workflows through payload-scoped inputs. Keep
all ordinary controls, feedback and save behavior working.

Delete displaced ordinary rendering/edit paths in this slice. No unused facade,
parallel form, generic registry, or compatibility wrapper waiting for slice B.
BBB can remain on its existing working UI until B. Independently review this
behavior-preserving slice before its intended commit.

### B — Bind BBB, delete its duplicate form, and close

Starting contacts: `TraitOfferEchoLastRunBoon.tsx`, the Echo portions of
`trait-offer-interactions.ts` / `contract.ts`, and engine
`authored-project/trait-carrier-children.ts` /
`simulation/candidates/trait-offer.ts`.

Add the bounded engine next/previous Echo draft transitions, bind partial BBB
rows to the shared form, and use the existing shape action row. Preserve exact
nested candidate and finding ownership and parent commit behavior.

Delete `EchoAllTogetherOutcome`, `EchoNaturalSelectionOutcome`, BBB's separate
target/row rendering, per-row Remove outcome controls, and displaced contracts
and CSS. A small BBB loader/controller may remain. Remove newly obsolete test
expectations rather than asserting historic UI no longer exists.

Independent adversarial review covers both slices as one product. Then perform
one broad phase closure and the intended final commit. Promote the small durable
ownership/UX conclusions to existing design documents and retire this plan and
its BBB investigation. Other investigations/plans are not implicitly closed.

## Acceptance and primary test ownership

- Engine Echo draft tests: supported sizes, no zero/four rows, append capability,
  incomplete-row removal, selected-tail clamping, retained prefix/payload and
  unchanged exact completion/domain checks. Keep the matrix here rather than
  duplicating it in every UI suite.
- Existing ordinary editor tests: ordinary size transitions, Rarify, Rejected,
  fallback/Start Over, fixed/effective rarity, Spell/Hex and Stone retain behavior.
- `TraitOfferResolution.test.tsx` and real `TraitOfferEditor.test.tsx`: BBB can
  author mixed providers and cached rarity, append/remove a blank tail, remove a
  selected tail, and complete/save/reopen through the real parent boundary.
- Reuse the six real Echo/Stone payload-chain witnesses. Retain incomplete
  sibling repair, exact candidate context, nested finding owner, payload
  retention and complete-offer Save. Shared compound suites own per-position
  repair and cancel semantics; add representative BBB integration, not another
  full policy matrix or giant JSON fixture.
- Preserve lazy candidate activation, complete-draft/assembly cache identity,
  stale-result protection and the existing ordinary focused-query work counts.
  Do not claim a new count baseline without measuring the existing witnesses.

During implementation run focused engine/UI/interaction tests and typecheck,
lint, formatting and diff checks. The main session runs the complete repository
`npm run check` and `npm run test` closure gates once after remediation is stable.
Record the truthful results at closure; do not refresh unrelated generated
fixtures or create protocol churn for this UI change.

## Audit against overengineering and regression

Acceptance is one smaller change neighborhood with the duplicate form gone,
not a prescribed line count. Report production/test growth and actual deletions.
Reject a common interface that merely forwards the existing ordinary and BBB
forms, a second copy of each compound editor behind wrappers, new domain policy
in React, fake completeness, or a broad engine candidate redesign for UI reuse.
No new schema, executor work, recursive payload framework, picker library,
route policy or blanket change to incomplete authoring is in scope.
