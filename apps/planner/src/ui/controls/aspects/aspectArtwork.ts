import axeCharon from './assets/Axe-Charon.webp';
import axeMelinoe from './assets/Axe-Melinoe.webp';
import axeNergal from './assets/Axe-Nergal.webp';
import axeThanatos from './assets/Axe-Thanatos.webp';
import bladesArtemis from './assets/Blades-Artemis.webp';
import bladesMelinoe from './assets/Blades-Melinoe.webp';
import bladesMorrigan from './assets/Blades-Morrigan.webp';
import bladesPan from './assets/Blades-Pan.webp';
import coatMelinoe from './assets/Coat-Melinoe.webp';
import coatNyx from './assets/Coat-Nyx.webp';
import coatSelene from './assets/Coat-Selene.webp';
import coatShiva from './assets/Coat-Shiva.webp';
import skullHel from './assets/Skull-Hel.webp';
import skullMedea from './assets/Skull-Medea.webp';
import skullMelinoe from './assets/Skull-Melinoe.webp';
import skullPersephone from './assets/Skull-Persephone.webp';
import staffAnubis from './assets/Staff-Anubis.webp';
import staffCirce from './assets/Staff-Circe.webp';
import staffMelinoe from './assets/Staff-Melinoe.webp';
import staffMomus from './assets/Staff-Momus.webp';
import torchesEos from './assets/Torches-Eos.webp';
import torchesMelinoe from './assets/Torches-Melinoe.webp';
import torchesMoros from './assets/Torches-Moros.webp';
import torchesSupay from './assets/Torches-Supay.webp';

/** Weapon aspect icons by catalog aspect key. */
export const aspectArtwork: Readonly<Record<string, string>> = {
  BaseStaffAspect: staffMelinoe,
  StaffClearCastAspect: staffCirce,
  StaffSelfHitAspect: staffMomus,
  StaffRaiseDeadAspect: staffAnubis,
  DaggerBackstabAspect: bladesMelinoe,
  DaggerHomingThrowAspect: bladesPan,
  DaggerBlockAspect: bladesArtemis,
  DaggerTripleAspect: bladesMorrigan,
  AxeRecoveryAspect: axeMelinoe,
  AxeArmCastAspect: axeCharon,
  AxePerfectCriticalAspect: axeThanatos,
  AxeRallyAspect: axeNergal,
  TorchSpecialDurationAspect: torchesMelinoe,
  TorchSprintRecallAspect: torchesEos,
  TorchDetonateAspect: torchesMoros,
  TorchAutofireAspect: torchesSupay,
  LobAmmoBoostAspect: skullMelinoe,
  LobCloseAttackAspect: skullMedea,
  LobImpulseAspect: skullPersephone,
  LobGunAspect: skullHel,
  BaseSuitAspect: coatMelinoe,
  SuitMarkCritAspect: coatNyx,
  SuitHexAspect: coatSelene,
  SuitComboAspect: coatShiva,
};
