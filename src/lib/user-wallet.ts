import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const access = z.object({
  email: z.string().trim().min(3).max(80),
  token: z.string().min(20).max(80),
});

export const loadPrivateWallet = createServerFn({ method: "POST" })
  .validator(access)
  .handler(async ({ data }) => {
    const { readPrivateWallet } = await import("./user-wallet-send");
    return readPrivateWallet(data.email, data.token);
  });

export const savePrivateWallet = createServerFn({ method: "POST" })
  .validator(access.extend({ wallet: z.unknown() }))
  .handler(async ({ data }) => {
    const { writePrivateWallet } = await import("./user-wallet-send");
    return writePrivateWallet(data.email, data.token, data.wallet);
  });
