# Biome depth live acceptance

Requires a debug log showing native `StartRoom` lines
(`StartRoom: <room> (RunDepth = …) (BiomeDepth = …)`, `RoomLogic.lua:1107`).
Read each value on fresh room entry, not after Save & Quit: a reload's map load
recomputes the cache. Automated tests are not live verification; the owner
confirms or waives each check.

- [ ] Dream run with N as its second or third biome. `BiomeDepth` reads 1 at
      the preceding `Dream_PostBoss`, 1 at `N_Opening01`, 1 at `N_PreHub01`
      (the deciding check) and 2 at the first `N_Hub` entry.
- [ ] Dream run with F as its second or third biome. `BiomeDepth` reads 1 at the
      preceding `Dream_PostBoss`, 0 at the `F_Opening` room, 1 at the first F
      combat (the deciding check) and 2 at the second.
- [ ] Ordinary run. `BiomeDepth` reads 1 at a biome's Postboss room.
- [ ] Ordinary run. `BiomeDepth` at a Boss room reads one more than at its
      Preboss (for example 12 at `F_Boss01` after `F_PreBoss01` at its forced
      depth 10 plus one, and 9 at `O_Boss01` after `O_PreBoss01` at 7 plus one).
