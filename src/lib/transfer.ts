import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const access = z.object({
  email: z.string().trim().min(3).max(80),
  token: z.string().min(20).max(80),
});

export const issueWalletSession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().trim().min(3).max(80),
      password: z.string().min(1).max(80),
    }),
  )
  .handler(async ({ data }) => {
    const { issueWalletSession: issue } = await import("./transfer-send");
    return issue(data.email, data.password);
  });

export const lookupPlatformUser = createServerFn({ method: "POST" })
  .validator(access.extend({ to: z.string().trim().min(3).max(160), coinId: z.string().max(80).optional() }))
  .handler(async ({ data }) => {
    const { lookupPlatformUser: lookup } = await import("./transfer-send");
    return lookup(data.email, data.token, data.to, data.coinId);
  });

export const transferToUser = createServerFn({ method: "POST" })
  .validator(
    access.extend({
      coinId: z.string().min(1).max(80),
      amount: z.number().positive().max(1e12),
      to: z.string().trim().min(3).max(160),
      usdValue: z.number().min(0).max(1e15).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { transferToUser: send } = await import("./transfer-send");
    return send({
      actorEmail: data.email,
      token: data.token,
      coinId: data.coinId,
      amount: data.amount,
      to: data.to,
      usdValue: data.usdValue ?? 0,
    });
  });

export const startPlatformSend = createServerFn({ method: "POST" })
  .validator(
    access.extend({
      coinId: z.string().min(1).max(80),
      amount: z.number().positive().max(1e12),
      to: z.string().trim().min(3).max(160),
      usdValue: z.number().min(0).max(1e15).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { startPlatformSend: send } = await import("./transfer-send");
    return send({
      actorEmail: data.email,
      token: data.token,
      coinId: data.coinId,
      amount: data.amount,
      to: data.to,
      usdValue: data.usdValue ?? 0,
    });
  });

export const settlePlatformSend = createServerFn({ method: "POST" })
  .validator(access)
  .handler(async ({ data }) => {
    const { walletEmailFor, settlePrivate } = await import("./transfer-send");
    const email = await walletEmailFor(data.email, data.token);
    if (!email) return { ok: false as const, error: "auth" as const };
    const wallet = await settlePrivate(email);
    if (!wallet) return { ok: false as const, error: "wallet" as const };
    return { ok: true as const, wallet };
  });
