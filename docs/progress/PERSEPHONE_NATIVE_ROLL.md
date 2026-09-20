# Persephone native roll correction

Status: locked for implementation.

## Contract

Author the native Persephone roll: 0 or 2–6; after prior Premium Service,
0 or 2–9. Without Jeweled Pom, zero means level 1 and positive rolls are
the starting level. With an active positive Pom contribution, the level is
roll + Pom contribution + 1. Replacement precedence and suppressed stack
boosts remain unchanged. This replaces the additive approximation documented
in the Persephone source audit.

## Delivery

One bounded slice owns catalog roll declarations, authored field and offline
migration, engine resolution, candidate projection and the existing editor.
Use explicit roll terminology, not an additive bonus. Migrate old positive
contributions by adding one; retain omitted/zero values. Follow existing strict
schema migration policy with one authored schema bump; execution continues
to carry effective levels and requires no protocol change.

Primary coverage belongs to offer-level resolution and migration, with focused
catalog and UI witnesses for the discrete domain. Cover both maxima, the gap
at one, Pom composition including zero, Premium acquisition timing,
replacement and suppression. Update only semantically affected generated
fixtures, preserving the repository formatter. Do not edit external user plans
in place or change executor behavior.

After implementation, obtain independent review, run repository closure checks,
replace the inaccurate source-audit disposition, and retire this document.
