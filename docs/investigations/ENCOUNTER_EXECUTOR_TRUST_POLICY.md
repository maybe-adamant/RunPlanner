# Encounter execution: one admission gate, trusted installation

## Status

Policy discussion draft, 2026-09-24. This records the agreed direction, not
implemented behavior. It supersedes the earlier diagnostic-only budget proposal
and unresolved Menace target-check disposition. Reconcile the component audit's
executor slice to this policy before implementation; no executor changes are
part of this document.

The current implementation contract remains in
`docs/design/GAME_INTEGRATION_BOUNDARY.md`. Promote the new contract there when
delivered, not before. This investigation is temporary.

## Governing policy

**The planner owns the complete legal result. Native preparation supplies the
facts for one whole-encounter admission decision. If admitted, install the
published result; otherwise diagnose and let native generation continue.**

Admission targets error-prone modeling boundaries. It does not re-prove simple
relationships already established by planner evaluation or structural decoding.
Check all waves before mounting any authored roster. Do not reconsider eligibility
mid-wave or mid-combat, partially fall back, or implement another count/budget
solver in Lua.

| Owner                | Responsibility                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Planner engine       | Derive expected budget, complete composition, exact source counts, Fangs and Menace outcomes. Publish complete-valid results. |
| Execution decoder    | Validate versions, shapes and internal payload relationships once.                                                            |
| Native preparation   | Resolve encounter overrides and calculate the actual budget with native depth, modifiers, Hordes and minimums.                |
| Admission adapter    | Compare the selected high-risk facts before enabling installation.                                                            |
| Installation adapter | Mount the admitted roster/counts and outcomes at existing native contacts.                                                    |
| Native runtime       | Own active caps, spawn pacing/locations, group expansion, retries and actual perk application.                                |

Uncustomized encounters pass through without customization steering or admission
work. Encounter identity retains its direct native IsEncounterEligible check;
rejection diagnoses and delegates selection without applying the rejected
variant's customization.

## Agreed generation flow

### 1. Supply an authored variable base roll where applicable

Currently the supported variable-budget case is GeneratedP_PreCombat. Bind the
operation to the exact encounter generation scope, not a global RNG pattern.

Validate the authored roll against the effective native base range before
supplying it. An invalid roll diagnoses and disables customization for this
preparation; leave the native roll and subsequent generation alone. A valid roll
becomes the input to native budget calculation. Never overwrite the derived
budget with the planner's answer.

The exact interception mechanism must be verified during implementation:
hard overrides must not erase the supplied roll, and unrelated RandomInt calls
for money, active caps, waves or nested generation must remain unaffected.

### 2. Let native calculate the final budget

GenerateEncounter resolves hard overrides and the room enemy set, calculates
DifficultyRating, applies Hordes and clamps to the minimum. Let this run normally;
do not duplicate its formula or generate a speculative encounter.

Immediately afterward native calls
CalculateActiveEnemyCap(currentRun, room, encounter), before selecting wave
count or creating wave templates. This is the proposed admission seam. A tightly
scoped wrapper must preserve the native cap function and its result, not alter
active-cap behavior.

Source: `RunLogic.lua:1150-1230`; cap calculation is in
`EncounterLogic.lua:1321`. The optional BuildCustomEnemySet mechanism has no
assignments in the inspected scripts and is out of scope. Do not build
speculative support around that unused extension.

### 3. Admit the entire customization once

The final native budget and effective encounter declaration are now available.
No authored wave-count override, highlight suppression, roster, Fangs assignment
or Menace conversion has yet been installed. Evaluate every wave together,
without mutating live selection state.

| Check             | Native evidence and limit                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Final budget      | Compare the exported engine-derived expectation to DifficultyRating with the existing float-tolerant policy. No duplicate formula.                                             |
| Wave count        | Check against effective native wave bounds before narrowing them. A random native draw need not match the authored possible outcome.                                           |
| Enemy composition | Check native pool membership and contextual eligibility, including live blacklists and relevant whole-composition restrictions. Honor fixed/template/highlight/addition roles. |
| Fangs perks       | Check native options, eligibility and ordered compatibility/exclusions for the published target. Do not repeat the elite-target or roster-membership proof.                    |
| Menace targets    | For positive conversions, verify the target against the native source mapping or replacement pool. Trust conversion counts; zero conversions need no target selection.         |

IsEnemyEligible alone does not validate an entire wave. Fixed seeds and replicated
highlights are not fresh ordinary draws. Testing an enemy after its own insertion
has blacklisted it would manufacture failure. Preserve necessary preselection
context, but do not add count arithmetic or unrelated generation behavior.
Review existing eligibility emulation by the facts this gate needs, rather than
assuming all of it must remain or all of it must disappear.

Native Menace availability gates for positive conversions belong with target
admissibility where they determine whether that replacement can occur: source/
encounter blocks, active vow and external next-biome visit eligibility. This
does not authorize recounting enemies, rolling chance, or treating replacement
targets as ordinary members of the source encounter's enemy pool.

### 4. Install completely or continue native

If every check passes, configure the published wave count and highlight handling,
then let native create its wave templates. Existing fill contacts mount the
approved enemies/counts; subsequent hooks apply approved Fangs/Menace outcomes.
All contacts consume the one admission decision, not fresh per-wave checks.

If any check fails, diagnose and enable none of those overrides. Native continues
with its own wave selection, highlight, enemies, Fangs and Menace. No restart,
replay or rollback is needed.

One qualification is explicit: a valid authored variable base roll may already
have been supplied. Rejection retains that legal input. This is native
continuation from a selected valid roll, not an untouched RNG history. Native
preparation's own earlier side effects are likewise not rolled back.

## Facts trusted after decoding and planner evaluation

- The decoder establishes the declared highlight exactly once in each wave and
  in the expected position. Installation consumes it without repeating checks.
- The decoder establishes Fangs roster membership; the planner establishes
  elite-target eligibility. Perk compatibility is the separate selected check.
- The planner owns source counts, allocation/remainder behavior, rounding and
  generation count limits. No second calculation in Lua.
- Decoding bounds Menace conversions by their published source counts. No
  repeated conversion-count validator or probability simulation.
- Decoding owns wave coverage, distinct identities and count-key agreement.
  Do not repeat those assertions in every hook.

Missing native definitions still require safe handling. Per-room Fangs caps are
application limits, not selection quotas: repeated selections can be legal even
when later units receive no perk. Leave application native; add no application
clock or combat simulation.

## Diagnostics and failure semantics

A failed admission, including a budget discrepancy, declines customization with
diagnostics. It does not introduce a plan mismatch/desynchronization boundary.
Existing transaction/conformance checks remain responsible for modeled run state.

Reuse existing diagnostics. Identify occurrence/phase, relevant wave/enemy/perk,
expected and observed facts where available, and whether admission was declined
or installation completed. Budget diagnostics retain the actual comparison values.

Observing whether installation contacts were reached is not redundant legality
validation. An unexpected missing fill contact is an integration failure; never
call it clean native fallback if roster mutation has already occurred. The gate
is not a rollback guarantee against unexpected native changes after acceptance.

Native generation/application errors propagate. Do not swallow them, rerun native
generation, fabricate alternatives or add mid-wave recovery.

## Export and verification implications

Current export carries wave count, optional base roll, enemy identities/provenance,
counts, Fangs and Menace. It lacks the derived expected budget. Produce that fact
in the engine and copy it through export unchanged; neither compiler nor Lua
derives it. Settle wire representation and compatibility explicitly before
implementation. This policy does not authorize an authored-save schema bump.

Verification should witness:

- Real planner-produced execution fixtures decoded by Lua, including expected
  budget and applicable outcomes; retain malformed-input decoder cases.
- Variable-roll range checks and isolation from unrelated RNG.
- Native budget calculation followed by one whole-encounter admission decision.
- Rejections leaving roster/outcome overrides disabled, with native continuation
  and the documented retained-base-roll behavior.
- Complete admitted installation and decision reuse across every wave.
- Native caps, pacing and actual perk application remaining in control.
- Error propagation and truthful missing-contact diagnostics.

Source-backed probes remain an explicit verification lane. Missing game scripts
are not a passed native check. No broad transaction framework, second generator,
new mismatch boundary or hypothetical custom-pool support belongs in this work.
