# Boon Boon Boon and the shared trait editor

## Question and disposition

Can Boon Boon Boon (BBB) reuse the standard trait editor, rather than maintain
its own rows and selected-trait payload controls?

Inspected at `2b1f30b5`. Recommendation: yes, reuse the trait-form rendering and
payload editing workflows. This is a bounded application/UI refactor, not a
direct substitution of the current `WorkspaceTraitOfferInteraction`.
Keep distinct engine domains, authored types, and commit destinations. Do not
manufacture an ordinary offer, giver declaration, or candidate result for BBB.
No production changes or new game-rule assumptions are part of this investigation.

## Current evidence

Paths below are relative to the repository root.

| Contact                                                                                      | Current responsibility and constraint                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/planner/src/ui/editor/rewards/TraitOfferEditorShell.tsx`                               | Owns ordinary draft state, candidate loading, feedback projection, effective rarity, Rejected, exhaustion add/remove, fallback, recovery, and nested navigation. Reads `traitOffer` candidate internals directly. It is not a neutral form today.                |
| `apps/planner/src/ui/editor/rewards/TraitOfferOrdinaryOption.tsx`                            | Renders familiar trait/rarity/selection rows, but also constructs ordinary authored edits, appends rarification actions, applies selected Hex defaults, and consults a single giver's rarity policy. Requires a defined trait identity.                          |
| `apps/planner/src/ui/editor/rewards/TraitOfferEchoLastRunBoon.tsx`                           | 549 lines: domain loader, nested navigation, partial row state, provider/trait and rarity controls, selection, add/remove, target editing, and separate All Together/Natural Selection implementations. Much of its presentation duplicates the ordinary editor. |
| `apps/planner/src/ui/editor/rewards/TraitOfferSelectedSpecialOutcomes.tsx`                   | Shared ordinary/Stone compound editors own prefix editing, cancellation, summary rows, and completion. Currently receive a whole ordinary offer and option-owned interaction.                                                                                    |
| `apps/planner/src/ui/editor/rewards/CompoundOutcomeEditor.tsx`                               | Existing common summary/step shell. BBB's compound editors do not use it. Sharing this alone would leave duplicated draft behavior.                                                                                                                              |
| `apps/planner/src/projections/structured-workspace/contract.ts`                              | `WorkspaceTraitOfferInteraction` accepts an `AuthoredTraitOffer`, one giver and ordinary candidate products. BBB uses partial `WorkspaceEchoLastRunBoonDraftRow` rows and `WorkspaceEchoLastRunBoonDomain`.                                                      |
| `apps/planner/src/projections/structured-workspace/interactions/trait-offer-interactions.ts` | Already binds BBB's trait distinctness, cached/effective rarity, completion, nested updates and child candidates to engine products. This semantic binding must remain distinct.                                                                                 |
| `packages/planner-engine/src/authored-project/trait-carrier-children.ts`                     | `completeAuthoredEchoLastRunBoonDraft` and `prepareEchoLastRunBoonDraft` preserve partial rows outside authored state and install only a complete nested value. No replacement is needed merely to share UI.                                                     |

The ordinary shell is 406 lines and its ordinary row is 227 lines. These counts
identify mixed responsibilities, not a deletion target or an argument for
turning them into a generic form framework.

## Necessary differences versus presentation duplication

| Concern            | Required distinction                                                                                                                   | Reusable presentation                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Trait identity     | Ordinary offer has one provider; BBB carries provider per row and uses the previous-run domain.                                        | Trait picker, row card, selected radio. The binding resolves a picker choice; the view must not infer provider from a label.         |
| Draft completeness | Ordinary opening normally starts with complete engine-generated identities. BBB can start with an empty row and missing rarity.        | Placeholder-aware rows and a disabled Save while incomplete. Do not fill BBB with invented traits just to satisfy ordinary types.    |
| Rarity             | BBB's authored rarity is cached; its effective grant rarity can differ. Ordinary rarity/rarification uses its own candidate semantics. | Rarity picker or fixed value, effective-value display. Do not publish cached rarity as a fresh roll or apply ordinary Rarify to BBB. |
| Row count          | BBB may append a blank row and remove a selected position; ordinary add/remove is an engine-produced exhaustion transition.            | Bound add/remove controls. The view does not compute maximums, distinctness, exhaustion or replacement legality.                     |
| Selected payload   | Shared authored outcome fields, but different exact query owners and candidate contacts.                                               | One target editor, one All Together editor and one Natural Selection editor, independent of carrier.                                 |
| Extras             | Ordinary paths may expose Rejected, Rarify, Persephone, Stone, Hex and Offer State. BBB must not inherit these merely through reuse.   | Render only bound supported controls; no `isBBB` checks scattered throughout the form.                                               |
| Commit             | BBB completes a child in the parent draft; the parent retains the complete-offer persistence boundary.                                 | Save/Cancel actions supplied by the owning controller. Do not give BBB a synthetic standalone `TraitOfferAddress`.                   |

Current duplication changes behavior, not just CSS:

- Echo All Together uses four separate pickers; ordinary/Stone uses grouped
  progression and per-set summary controls.
- Echo Natural Selection renders an arrow list and restarts on “Choose all
  targets”; ordinary/Stone supports position-based prefix repair and local
  cancellation before publishing a complete sequence.
- Echo repeats selected target rendering and payload field transport in its
  local row construction. Reuse should remove these parallel editing paths,
  not simply give them matching classes.

## Recommended boundary

One shared trait-form rendering path receives application-bound rows, picker
loading capabilities, supported edit actions, feedback and selected-payload
controls. It does not read raw simulation result unions or construct semantic
commands. Use existing contextual picker and compound editor primitives.

The ordinary binding retains its current authored draft, candidate assessment,
special controls and command destination. The BBB binding retains its typed
partial rows, engine completion/domain checks and nested destination. Both
produce the same presentation shape; this is a real two-consumer boundary,
not a new engine product. Keep state explicit and owned by these controllers.

Move the ordinary row's edit construction and ordinary shell's result
interpretation into their owning binding as required for reuse. Do not move
domain policy into a common view. Share payload draft behavior as well as
rendering: bindings provide the exact candidate query/update contact while the
payload editor owns transient prefix, cancel, and completion interaction.

“Reuse the whole editor” means one trait-form UI, not forcing Chaos, standalone
dialog persistence and BBB nested navigation through an identical lifecycle.
The existing dedicated Chaos presentation can stay where it is. A small BBB
loader/back/save wrapper is justified; separate BBB row and payload renderers
are not.

## Alternatives and cost check

- **Feed BBB into the current ordinary interaction unchanged:** reject. It
  requires fake complete rows, a fake single giver, ordinary candidate-shaped
  results, and inappropriate special actions.
- **Only share CSS or `CompoundOutcomeEditor`:** smaller change but leaves the
  duplicate row construction and editing/cancel behavior that prompted this work.
- **Shared form with separate typed bindings:** recommended. More initial work
  than a styling pass, but deletes BBB's parallel form and outcome editors.
- **Generic recursive editor/plugin registry:** reject. Only two concrete offer
  authoring forms need this boundary; the existing payload families are closed.

The subsequent agreed size policy uses BBB next/previous-size drafts and removes
only the final row. A selected removed tail clamps selection to the new final
row. This justifies a bounded addition to the existing engine Echo draft helpers,
not a new editor-specific engine product or a change to ordinary exhaustion.
BBB's former per-row removal need not be preserved.

No schema, catalog, simulation-effect, execution-protocol or executor change is
justified by current evidence. Exact net code reduction cannot be promised
until the binding extraction is designed; reject a result that preserves both
old form implementations behind a new forwarding layer.

## Witnesses and remaining decisions

Reuse `TraitOfferEditor.test.tsx`'s real Echo/Stone six-chain witnesses and
`TraitOfferResolution.test.tsx`'s BBB domain/row interactions. Preserve blank
rows, sibling-incomplete repair, cached/effective rarity, selected-tail removal,
and parent Save/Cancel semantics. Shared compound tests own cancellation and
prefix behavior; do not copy that full matrix for every carrier.

Ordinary witnesses must still cover Rarify, Rejected, fallback/Start Over,
exhaustion shape changes, Spell/Hex and Stone. UI reuse must not change which
engine queries are issued or eagerly query every possible candidate at render.

Before implementation, specify the smallest common row/action contract and
the exact old rendering paths it deletes. Preserve current BBB navigation and
commit behavior unless a separate UX decision changes them. This investigation
does not authorize the refactor or lock a delivery plan.
