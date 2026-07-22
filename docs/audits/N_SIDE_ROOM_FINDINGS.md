# N Side-Room Findings

## Purpose

This document preserves the runtime-derived availability ranks used by the N
side-room generation model. `../biomes/N_GAME_RULES.md` remains the design authority;
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

## Authority Boundary

This table is runtime evidence, not a second side-room design authority.
`../biomes/N_GAME_RULES.md` owns the live availability-pressure, joint reward
batch, and player-selected entry-order contracts derived from it.
