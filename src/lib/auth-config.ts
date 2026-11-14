export const CLIENT_ACCOUNT = {
  email: "akbarmousavi1356@gmail.com",
  password: "Hr39/Vopq9",
} as const;

export const ADMIN_ACCOUNT = {
  email: "amir.behi2333@gmail.com",
  password: "Amir6229",
} as const;

/** @deprecated use CLIENT_ACCOUNT */
export const DEMO_ACCOUNT = CLIENT_ACCOUNT;

export type UserRole = "admin" | "client";
export type ScenarioCode = "T20" | "F20" | "K20";

export const SCENARIO_CODES: ScenarioCode[] = ["T20", "F20", "K20"];

export function isAdminEmail(email: string) {
  return email.trim().toLowerCase() === ADMIN_ACCOUNT.email.toLowerCase();
}

export function isClientEmail(email: string) {
  return email.trim().toLowerCase() === CLIENT_ACCOUNT.email.toLowerCase();
}
