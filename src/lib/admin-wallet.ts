import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADMIN_ACCOUNT } from "@/lib/auth-config";

const proof = z.object({ proof: z.string().max(200) });

const walletPatch = proof.extend({
  email: z.string().trim().min(3).max(80),
  profile: z.object({
    firstName: z.string().max(120),
    lastName: z.string().max(120),
    email: z.string().max(120),
    address: z.string().max(240),
    phone: z.string().max(40),
    nationalId: z.string().max(40),
    licensePhoto: z.string().max(1_500_000).nullable(),
  }),
  holdings: z.array(z.object({ id: z.string().max(80), amount: z.number().min(0).max(1e15) })).max(40),
  addresses: z.record(z.string().max(40), z.string().max(180)),
  scenario: z.enum(["T20", "F20", "K20"]).nullable(),
});

function allowed(value: string) {
  return value === ADMIN_ACCOUNT.password;
}

export const loadAdminWallet = createServerFn({ method: "POST" })
  .validator(proof.extend({ email: z.string().trim().min(3).max(80) }))
  .handler(async ({ data }) => {
    if (!allowed(data.proof)) return { ok: false as const, wallet: null };
    const { adminReadWallet } = await import("./admin-wallet-send");
    return { ok: true as const, wallet: await adminReadWallet(data.email) };
  });

export const saveAdminWallet = createServerFn({ method: "POST" })
  .validator(walletPatch)
  .handler(async ({ data }) => {
    if (!allowed(data.proof)) return { ok: false as const, wallet: null };
    const { adminWriteWallet } = await import("./admin-wallet-send");
    const wallet = await adminWriteWallet(data.email, {
      profile: data.profile,
      holdings: data.holdings,
      addresses: data.addresses,
      scenario: data.scenario,
    });
    return { ok: true as const, wallet };
  });
