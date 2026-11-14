import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADMIN_ACCOUNT } from "@/lib/auth-config";

const credentials = z.object({
  email: z.string().trim().min(3).max(80),
  password: z.string().min(1).max(80),
});

export const registerAccount = createServerFn({ method: "POST" })
  .validator(credentials)
  .handler(async ({ data }) => {
    const { createAccount } = await import("./accounts-send");
    return createAccount(data.email, data.password);
  });

export const loginAccount = createServerFn({ method: "POST" })
  .validator(credentials)
  .handler(async ({ data }) => {
    const { matchAccount } = await import("./accounts-send");
    return matchAccount(data.email, data.password);
  });

export const listAccounts = createServerFn({ method: "POST" })
  .validator(z.object({ proof: z.string().max(200) }))
  .handler(async ({ data }) => {
    if (data.proof !== ADMIN_ACCOUNT.password) return { ok: false as const, accounts: [] };
    const { readAccounts } = await import("./accounts-send");
    return { ok: true as const, accounts: await readAccounts() };
  });

export const removeAccount = createServerFn({ method: "POST" })
  .validator(z.object({ proof: z.string().max(200), email: z.string().max(80) }))
  .handler(async ({ data }) => {
    if (data.proof !== ADMIN_ACCOUNT.password) return { ok: false as const };
    const { deleteAccount } = await import("./accounts-send");
    return deleteAccount(data.email);
  });
