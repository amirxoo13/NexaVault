/** Wall-clock length of a real send. Each step does one part of the transfer. */
export const SEND_PIPELINE_MS = 21_000;

export const SEND_STEPS = [
  "Checking the destination",
  "Calculating the network fee",
  "Reserving the amount and fee",
  "Signing the transfer",
  "Broadcasting to the network",
  "Confirming on the network",
  "Delivering to the recipient",
] as const;

const notified = new Set<string>();

export function claimNotice(hash: string) {
  if (!hash || notified.has(hash)) return false;
  notified.add(hash);
  return true;
}

export function sendStepIndex(started: number, ends: number, now: number): number {
  if (!started || !ends || ends <= started) return 0;
  if (now >= ends) return SEND_STEPS.length;
  const ratio = (now - started) / (ends - started);
  return Math.min(SEND_STEPS.length - 1, Math.floor(ratio * SEND_STEPS.length));
}
