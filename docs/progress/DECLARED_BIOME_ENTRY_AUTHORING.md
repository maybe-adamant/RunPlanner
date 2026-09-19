# Declaration-driven biome entry authoring

Status: locked for implementation. Base: `02c01e99`.

## Contract

Remove the separate Start biome confirmation. Resolve entry identity from the
layout declaration, never a biome-name conditional. Exactly one declared entry
is initialized with project creation, prefix expansion, and ClearTopology.
Multiple declared entries remain unset until the user chooses one directly.
First-itinerary entry identity/reward controls remain in Loadout; subsequent
entry controls remain in their biome Overview. Existing ordinal-resolved reward
and encounter profiles remain authoritative, including rewardless later entries.

Creation is an atomic authored transition, not a React effect watching readiness.
Creating fixed structure does not assess or unlock downstream regions. Existing
occurrence payloads, topology ownership, command reconciliation and Undo apply.
Start creation makes only the initial occurrence, not doors, PreHub, or Hub.

Schema shape is unchanged. Decoding continues to preserve existing null starts;
an imported unstarted biome can be repaired through the same entry picker, even
when its declaration has a single choice. Do not introduce decode-time repair,
idempotent CreateStart compatibility, a second initialization model, or flags to
preserve obsolete test setup. Explicit CreateStart must select a multi-choice
entry rather than silently choosing its first declaration.

## Ownership and delivery

1. Engine: share declaration-owned entry construction across defaults, prefix
   configuration, explicit creation and clearing. Fixed occurrence IDs are
   deterministic and biome-scoped; existing IDs remain untouched. Adapt affected
   tests/builders honestly to automatic fixed starts or explicitly constructed
   unstarted inputs when that is their actual subject.
2. Application/UI: bind available entry identities and a complete creation intent
   to the existing start frontier; replace Start buttons with one room picker.
   Preserve engine readiness, semantic finding destination and first/later
   presentation. Do not generate eligibility or initialize during rendering.
3. Independent review, representative first/later Dream witnesses, complete
   repository check, then integrate the changed start contract in the authored
   model/editor authority and retire this document.

## Acceptance

- Single-choice versus multi-choice behavior is declaration-driven.
- Ordinary and supplied Dream itineraries initialize correct route-position
  profiles, including later F choices and first non-F reward-bearing entries.
- One configuration/clear/selection is one history edit; Undo restores exact
  prior structure. Existing authored prefixes and occurrence IDs are retained.
- Loadout incompleteness still locks first-room editing; preceding incompleteness
  still locks later entry editing, without hiding its retained structure.
- Imported null starts remain repairable, and findings target the new picker.
- Existing N Opening/PreHub/Hub topology is not eagerly expanded.
- No schema/protocol/fixture-format changes, encounter-rule changes, public Dream
  creation UI, or new route authoring policy.

Primary tests live with engine defaults/commands and app interaction binding;
UI/product witnesses cover first entry, fixed entry, later multi-choice entry,
old-null repair and history. Regenerate no unrelated execution fixtures.
