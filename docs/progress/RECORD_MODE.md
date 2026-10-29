# Record Mode

Status: locked 2026-10-26. Base commit: `f354e3039`. No
authored schema change; one catalog-schema addition.

## Objective

Players of unmodded categories can replicate their runs without stepping
through a video. While recording is on, the desktop planner watches the Hades
II save folder; at run end it imports the observed run as an ordinary plan in a
**Recent runs** home tab, which lists the last 20 recorded runs and adds any of
them to the library the way the Catalog tab does.

Evidence: the save-file run record audit
(`docs/audits/rooms-and-routes/SAVE_FILE_RUN_RECORD_GAME_DATA_AUDIT.md`).

## Settled decisions

1. **Only while recording.** A save cannot rebuild a past run (room history is
   stripped to a whitelist, boon screens and shop stock are not kept), so runs
   are captured live, checkpoint by checkpoint.
2. **Threshold.** A run is kept only once it reaches the first biome's Preboss.
   The rolling list keeps 20 runs; the number is a setting constant.
3. **End of run only.** The plan is built when the run ends (or is abandoned,
   below); while recording, the tab shows a recording indicator, not a live
   plan.
4. **The record is kept beside the plan**, and a row's Rebuild action
   re-imports it with the current importer. Release builds never keep raw
   saves; dev builds keep each run's accepted saves beside its entry, and
   Rebuild then rebuilds the record from them first.
5. **Assumptions:** aspect and keepsake at maximum level (the planner-wide
   rule; not reported). Everything else the record cannot answer is guessed
   and reported (decision 8): a collected Fields optional reward takes the
   first free optional point, and room-action and purchase order the native
   order wherever trait timestamps (`Hero.Traits` ids) do not order them. An
   unpicked ship-wheel offer's type is solved from the saved stores and
   reported only when fits differ in exit state or none fits; its Boon god
   leaves no trace, so it takes the first god the wheel admits, unreported.
   Which wheel took which side when a ship's wheels used both is solved the
   same way, starting from Left picks first in setup order.
6. **Encounters** are imported by inverting the saved waves into the authored
   generated customization (wave count, highlight, types, base roll,
   allocations), verified by replaying the forward model; a phase whose replay
   disagrees keeps its selected encounter with default customization. No
   exact-roster form.
7. **Run boundaries.** Start: the first `_Temp` from `Hub_PreRun` with empty
   room history. End: the hub save with the hero dead (victory shows in the
   post-boss `_Temp` first). Identity: the header run count. A new run start
   while one is open, without its end save, closes the open run as abandoned at
   its last checkpoint; the threshold still applies.

8. **Guesses are always reported.** When the record cannot answer a decision
   the evaluation needs, or the engine refuses the observed value, the
   importer applies the first eligible candidate, as Draft does, and records
   an import-report entry: the semantic address, the value applied and the
   reason (not in save, refused, inverse mismatch, area not yet supported).
   Non-blocking leaves the record cannot answer stay unauthored and surface as
   findings. The report is stored with the run, not in the plan (provenance in
   authored state would be a schema change); the Recent runs row shows its
   count and opens the list.
9. **Unsupported areas fall back loudly.** Areas no capture has exercised yet
   (Steady Growth, Travel Deal refill, Eris, Anomaly, Gorgon, Judgment,
   Fig Leaf, Sea Star, Hammer and Pom equip results, Selene Hex tree, Fresh
   File) take decision 8's fallback, each hit reported with its area, so
   recorded runs inventory what to support next. Duo screens go through the
   generic offer path and their outcome children through decision 11.
10. **Rarify clicks from spent charges.** The record keeps each rarify
    source's charges left at every entry save, not which row took a click.
    A room spends its entry charges plus the engine's advance of the current
    keepsake when the room picks Cherished Heirloom, less the next entry's.
    Each room's spent charges become clicks, each judged by the engine: the
    picked row first (acquired rarity = rolled + its clicks, repeated for
    Calling Card), then the screen's other rows, then its rerolled-away
    screens newest first. The row chosen is not reported, since the pick and
    the charges are the same either way; a charge no screen takes, like any
    other remaining-charge difference, is the entry-save comparison's mismatch.
    The hover correction lowers only rows no click explains.
11. **Special traits: one importer pass.** A picked trait whose outcome is an
    authored child is answered by one pass over the screen's final rows, each
    child from the record at its own carrier's acquisition time and checked
    against the engine's domain. A child never stops the import: one the
    record cannot answer, or whose value the engine refuses, takes the
    engine domain's first value (Draft's policy) and is reported. The
    owner-confirmed list (2026-10-29): carrier children of All Together,
    Bridal Glow, Natural Selection, Latest Model, Pom Pom Pom (its no-target
    case included), Circe's Red Citrine, Lapis and Black Night, Boon Boon
    Boon, and any of these as Concave Stone's extra pick; and room uses shared
    by Sea Star's duplicates with Buried Treasure's, Quick Buck's, Narcissus's
    and Supply Chain's generated pickups. Values inferred but leaving the same
    state (Natural Selection's order, which same-type generated pickup was
    taken) are not reported; a Sea Star duplicate that could explain the same
    uses as a collected generated pickup is placed after the pickups, reported
    as an assumption.

## Ownership

- **Planner engine** owns the **run record** contract (observed facts in game
  vocabulary: loadout, rooms in order with encounter waves, Fangs perks, kills,
  doors and offered rewards, chosen exit, boon screens, shop stock and evidence
  of purchases, wheel and Fields facts, counters) with a strict codec, the
  generated-encounter inverse, and `projectFromRunRecord`: a pure,
  frontier-driven import that creates the project for the record's route,
  follows the evaluation issue like Draft, answers each question from the
  record, validates the value through the candidate session, applies one
  command through edit settlement, and returns the project plus the import
  report. Game-name to catalog-key mapping uses the catalog; the engine owns
  no save-format knowledge.
- **Hades II catalog** adds, per Fields cage point, one representative point id
  of its enemy spawn group (from the room maps), so a cage's saved spawn group
  resolves to its cage point. No catalog version bump: no plan changes meaning.
- **Planner application** owns the save decoder (SGB1 header, LZ4 block,
  luabins) and the extractor from decoded save tables to the run record, the
  run-boundary state machine that accumulates checkpoints, the import worker,
  the Recent-runs store (host-backed on desktop), the tab, the recording toggle
  and indicator, and desktop-only gating like the catalog feed.
- **Desktop host (Rust)** owns save-folder discovery, polling for changed save
  files, and reading their bytes; it holds no game semantics. The decoder stays
  in TypeScript so the format and extraction share one test lane.
- **Game module:** untouched.

## Gates

1. **Audit and plan** committed (docs only).
2. **Record contract** (engine): types and strict codec; the extractor and the
   fixture script (app, reading the captures outside the repo) produce compact
   records from both captures, committed as engine test fixtures (Prettier
   JSON, raw saves never committed).
3. **Catalog spawn groups**: `FieldsSpatialDeclaration` addition, compiler,
   declarations for all 15 H rooms; H_Combat13's unmapped point stays unmapped
   and resolves by elimination.
4. **Encounter inverse** (engine): inverse plus replay check, fixed prefixes,
   intro substitution, Fangs, Menace (per wave when the source type is unique),
   spill and infinite rosters; fallback to default.
5. **Import core** (engine): project creation, loadout, route, doors, Hub,
   encounters, trait offers and replacements, Artificer dispositions, the
   import report, guess policy (decision 8).
6. **Import rooms** (engine): World Shop, Hermes Shrine (rushed and delayed
   purchases), Well, Pool, Anvil, Embryo, Path of Stars, Chaos gates, keepsake
   racks, fountains, ship wheels, Fields cages, optional rewards and spatial
   points, NPC encounters, Menace.
7. **Host and recorder** (Rust and app): discovery, polling, read; decoder;
   boundary state machine; store with the 20-run limit and Preboss threshold.
8. **Recent runs tab** (app): shape iteration with screenshots first, then
   tests; add to library, import-report summary, recording toggle and
   indicator.
9. **Closure:** product witness with a synthetic save stream, full
   `npm run check`, durable design note for the import policy, audit
   disposition update, live checklist in `docs/testing/`, plan deleted.

## Tests

- Engine: codec and fixture round-trip; inverse against
  `assessGeneratedEncounter` over every captured wave; import of both capture
  records with an expected-findings and import-report snapshot per area;
  import time measured once with the performance lane.
- Catalog: declaration and normalization for the spawn-group ids.
- App: decoder on tiny synthetic saves; extractor against decoded samples;
  boundary state machine (start, end, victory, abandon, resume); store limit
  and threshold; tab interaction.
- Rust: discovery and polling in the tested host crate.

## Non-goals

- Reconstructing runs that were not recorded, or from the hub save's run
  history.
- Recording on the web build.
- Seeds, enemy spawn positions, or any
  value the audit lists as never saved.
- An exact-roster encounter form, or any game-module change.
