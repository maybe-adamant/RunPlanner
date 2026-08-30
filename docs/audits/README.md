# Source audits

These audits preserve source-backed Hades II facts, source contacts, observed
uncertainties, discrepancies with the planner, and the current planner
disposition. They are evidence, not package architecture or implementation
plans: stable ownership rules belong in `docs/design/`, biome behavior belongs
in `docs/biomes/`, and temporary delivery mechanics belong in
`docs/progress/`.

## Where to look

The folders route a question to the audit that owns its evidence. They are a
reader-facing taxonomy, not a package or runtime boundary.

- [Rooms and routes](rooms-and-routes/) — Which rooms, encounters, exits,
  route detours, and room-action phases can occur, and in what order?
- [Rewards and acquisition](rewards-and-acquisition/) — Which rewards can be
  offered, and how do authored defaults, acquisition, delivery, fallback, and
  settlement interact?
- [Traits](traits/) — Which trait pools, offer rules, rarity transitions, and
  run-impacting trait effects does the game support?
- [Loadout and progression](loadout-and-progression/) — How do Arcana, Fear,
  keepsakes, and keepsake-driven progression behave?
- [Room features](room-features/) — Which optional or automatic room features
  exist, where can they occur, and which effects matter to the simulation?
- [Editor](editor/) — What source-backed terminology and cross-biome authoring
  findings should inform the editor without becoming editor architecture?

## Audit map

### Rooms and routes

- [Encounter selection and composition](rooms-and-routes/ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md) — Encounter envelopes, selectable compositions, and their room-level constraints.
- [Enemy formation and Fear Vows](rooms-and-routes/ENEMY_FORMATION_AND_FEAR_VOW_GAME_DATA_AUDIT.md) — Generated Combat and Devotion waves, enemy types and counts, and the intervention order for Hordes, Menace, Fangs, Return, and adjacent Vows.
- [I/Q World Shop phases](rooms-and-routes/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md) — World Shop phase and inventory timing across I and Q.
- [Room action order](rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md) — Source-backed room lifecycle and action ordering contacts.
- [Route detours](rooms-and-routes/ROUTE_DETOUR_FINDINGS.md) — Chaos, Oceanus Anomaly, Zagreus Contract, Spark, and other route-level detour, exit, and host-room findings.

### Rewards and acquisition

- [Acquisition, delivery, and room settlement](rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md) — Pickup, purchase, generated delivery, and room-settlement evidence.
- [Authored reward and trait defaults](rewards-and-acquisition/AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md) — Unresolved and retained-invalid authored reward and trait defaults against source declarations.
- [Fields optional rewards and Artificer](rewards-and-acquisition/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md) — Fields optional inventory and Artificer conversion facts.
- [Reward game data](rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md) — Reward declarations, bags, stores, and acquisition identity evidence.
- [Runtime offer fallback](rewards-and-acquisition/RUNTIME_OFFER_FALLBACK_AUDIT.md) — Safe fallback behavior when authored offers are unavailable at runtime.

### Traits

- [All Together and Shop traits](traits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md) — All Together, Infernal Contract, Travel Deal, and shop-trait acquisition facts.
- [Boon rarity ledger](traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md) — Boon rarity availability, weights, and rarity-transition declarations.
- [Chaos traits](traits/CHAOS_TRAIT_GAME_DATA_AUDIT.md) — Chaos trait declarations, effects, and offer constraints.
- [Persephone, Premium Service, and offered levels](traits/PERSEPHONE_PREMIUM_EFFECTIVE_LEVEL_AUDIT.md) — Aspect-owned starting levels, Premium chronology, Jeweled Pom composition, and replacement precedence.
- [Run-impacting trait effects](traits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md) — Trait effects that change modeled run state or timeline outcomes.
- [Selene spells](traits/SELENE_SPELL_GAME_DATA_AUDIT.md) — Spell and Hex declarations, drops, and equipment facts.
- [Trait offer composition and Fear pressure](traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md) — Offer composition, pressure, and Fear-related source rules.
- [Trait offer pools and dependencies](traits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md) — Provider pools, dependencies, fallback relationships, and offer eligibility.

### Loadout and progression

- [Arcana and Fear](loadout-and-progression/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md) — Arcana board, Fear, and progression declarations.
- [Cherished Heirloom](loadout-and-progression/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md) — Cherished Heirloom progression and supported keepsake effects.
- [Echo Gift Gift Gift](loadout-and-progression/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md) — Echo's Gift Gift Gift keepsake capture and replay facts.
- [Hex talent layouts](loadout-and-progression/HEX_TALENT_LAYOUT_GAME_DATA_AUDIT.md) — Generated layout capacities, Rare/Epic identity pools, Olympian extensions, and full-tree closure.
- [Keepsakes](loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md) — Keepsake declarations, acquisition, and effect lifecycle evidence.
- [Path of Stars and Spell Drop](loadout-and-progression/PATH_OF_STARS_AND_SPELL_DROP_GAME_DATA_AUDIT.md) — Path point values, ordered initial spell bonuses, Aspect of Selene routing, and Moon Beam point contacts.
- [Olympian keepsakes and Moon Beam](loadout-and-progression/OLYMPIAN_KEEPSAKE_AND_MOON_BEAM_REWARD_PRESSURE_AUDIT.md) — Reward-priority lifetime, provider pressure, rarification, and exact Selene/Path targeting.

### Room features

- [Room features](room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md) — Natural resources, Pools of Purging, Shrines of Hermes, Stygian Wells, and related feature-specific source evidence.

### Editor

- [Editor UX](editor/EDITOR_UX_AUDIT.md) — Cross-biome terminology and editor-facing findings grounded in the current authoring model.

## Cross-cutting policy

Each fact has one primary audit owner. A cross-cutting audit links to that
owner instead of copying its source matrix or planner disposition; consumers
may retain only the context needed to explain their own question. When a fact
is unsettled, record the source contact, uncertainty, and current planner
disposition in the narrowest owning audit. Do not turn an unresolved fact into
a generic production value or a speculative implementation checklist.
