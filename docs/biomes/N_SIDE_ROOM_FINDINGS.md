# N Side-Room Findings

## Purpose

This document preserves the runtime-derived availability ranks used by the N
side-room generation model. `N_GAME_RULES.md` remains the design authority;
this file records the evidence that cannot be recovered from Lua declarations
alone.

The ranks were observed in the Hades II `h2-dev` profile on 2026-07-18 by
forcing every local side door to participate in generation and recording the
order in which physical door obstacles ran their availability checks.

## Availability Ranks

| Parent       | Ranked side rooms               |
| ------------ | ------------------------------- |
| `N_Combat02` | `N_Sub03`, `N_Sub01`            |
| `N_Combat04` | `N_Sub06`, `N_Sub02`            |
| `N_Combat05` | `N_Sub02`, `N_Sub07`, `N_Sub03` |
| `N_Combat06` | `N_Sub05`, `N_Sub10`            |
| `N_Combat09` | `N_Sub08`, `N_Sub11`, `N_Sub14` |
| `N_Combat10` | `N_Sub09`, `N_Sub05`            |
| `N_Combat12` | `N_Sub09`, `N_Sub10`, `N_Sub07` |
| `N_Combat22` | `N_Sub14`, `N_Sub02`            |
| `N_Combat23` | `N_Sub13`, `N_Sub15`, `N_Sub12` |

## Model Conclusions

- Availability rank is the only side-room order used by generation pressure.
  When the minimum side-room count has not been met, the game forces a prefix
  of this ranked list.
- Generated sibling rewards are resolved before player entry and form one
  unordered joint batch for duplicate and counted-bag validation. Incidental
  callback iteration does not define a second room rank.
- Generated side rooms may be entered in any player-selected order. Authored
  entered ordinals preserve exact history and eventual execution intent, but
  entry permutations do not change the modeled final state on return to the
  parent room.
