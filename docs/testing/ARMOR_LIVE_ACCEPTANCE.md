# Armor live acceptance

Use a matching current planner and installed game-module build. Take no damage
during these checks, since the planner assumes armor is never consumed.
Compare the hero's armor bar with the planner's Run State Armor row at the
same moment. Source probes and automated tests are not live verification; the
owner confirms or waives each check.

## Practice starts

- [ ] Author a plan that buys Splintered Shield at a Well and picks an armor
      room reward or Shop item, then start Practice at a later Opening or
      Preboss. The start room shows the plan's item armor total, and the
      start-room self-check passes.
- [ ] Start Practice with a Silken Sash held across several earlier rooms. The
      start room shows the Sash's planned armor, including the start room's own
      door gain.

## Silken Sash

- [ ] Hold the Sash through several rooms of a biome. Armor rises by its rank's
      gain (4 at the ordinary rank) on each door into a new room, and the
      Armor row matches.
- [ ] In Ephyra, return to the Hub several times. Hub and main-room returns
      add no armor.
- [ ] Swap the Sash away at a Keepsake rack. Its armor stays as hidden item
      armor, and the next rooms add nothing more.
- [ ] Gift Gift Gift with the Sash captured: at the next biome start, with no
      Sash held, the Common copy grants 30 and then 2 per new room.
- [ ] Cherished Heirloom with the Sash equipped: armor doubles (the moved
      armor plus the restored Sash armor), and later doors add 6.

## Run State Armor

- [ ] With Trusty Shield, Heavy Metal, an Arachne dress or an Icarus coating
      held, the Armor row and its sources match the in-game armor.
- [ ] On a Dream route, take Onyx Dress or Protective Coating from a later
      biome's menu. The in-game armor matches the planner's rarity-scaled
      value (Onyx 80/100/140, Protective 140 in the fourth biome). A
      Practice start after that pick shows the same armor.
- [ ] On a Dream route, take Word of Greater Girth from Circe's menu in the
      fourth biome. A Practice start after that pick passes the max-health
      self-check (×1.30 health).
