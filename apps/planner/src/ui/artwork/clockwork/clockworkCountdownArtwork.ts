import iconClockworkCountdown0 from './assets/ClockworkCountdown0.webp';
import iconClockworkCountdown1 from './assets/ClockworkCountdown1.webp';
import iconClockworkCountdown2 from './assets/ClockworkCountdown2.webp';
import iconClockworkCountdown3 from './assets/ClockworkCountdown3.webp';
import iconClockworkCountdown4 from './assets/ClockworkCountdown4.webp';
import iconClockworkCountdown5 from './assets/ClockworkCountdown5.webp';
import iconClockworkCountdown6 from './assets/ClockworkCountdown6.webp';

/** Clockwork Goal door icons by goals remaining; `null` marks a key with no icon yet. */
export const clockworkCountdownArtwork: Readonly<Record<string, string | null>> = {
  '0': iconClockworkCountdown0,
  '1': iconClockworkCountdown1,
  '2': iconClockworkCountdown2,
  '3': iconClockworkCountdown3,
  '4': iconClockworkCountdown4,
  '5': iconClockworkCountdown5,
  '6': iconClockworkCountdown6,
};
