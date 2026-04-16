/**
 * Haptic feedback utility using the Vibration API.
 * Falls back silently on unsupported devices.
 */

const isSupported = typeof navigator !== "undefined" && "vibrate" in navigator;

/** Light tap — button press, navigation */
export function hapticLight() {
  if (isSupported) navigator.vibrate(10);
}

/** Success — correct answer, achievement unlocked */
export function hapticSuccess() {
  if (isSupported) navigator.vibrate([10, 50, 10]);
}

/** Error — wrong answer, validation failure */
export function hapticError() {
  if (isSupported) navigator.vibrate([30, 50, 30, 50, 30]);
}

/** Heavy — important action confirmed (streak, level up) */
export function hapticHeavy() {
  if (isSupported) navigator.vibrate([50, 30, 80]);
}

/** Notification — new message, alert */
export function hapticNotification() {
  if (isSupported) navigator.vibrate([15, 100, 15]);
}
