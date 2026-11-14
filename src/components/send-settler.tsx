import { useEffect } from "react";
import { notifyWalletMove } from "@/lib/push";
import { useWallet } from "@/lib/store";
import { settlePlatformSend } from "@/lib/transfer";
import { claimNotice } from "@/lib/send-pipeline";

/** Finish sends whose network confirmation time has passed, even if the send screen was closed. */
export function SendSettler() {
  const email = useWallet((s) => s.accountEmail);
  const token = useWallet((s) => s.accountToken);

  useEffect(() => {
    if (!email) return;
    let stop = false;
    const run = async () => {
      const now = Date.now();
      const local = useWallet.getState().transactions.filter(
        (tx) => tx.type === "send" && tx.status === "pending" && !tx.peerEmail && tx.settlesAt && tx.settlesAt <= now,
      );
      if (local.length) {
        const ids = new Set(local.map((tx) => tx.id));
        useWallet.setState((s) => ({
          transactions: s.transactions.map((tx) => (ids.has(tx.id) ? { ...tx, status: "confirmed" as const } : tx)),
        }));
        for (const tx of local) {
          if (!claimNotice(tx.hash)) continue;
          void notifyWalletMove({
            data: {
              email,
              token,
              direction: "sent",
              symbol: tx.symbol,
              amount: tx.amount,
              usd: tx.usdValue,
              counterparty: tx.toAddress ?? "",
              network: "",
              hash: tx.hash,
            },
          }).catch(() => undefined);
        }
      }
      const remote = useWallet.getState().transactions.some(
        (tx) => Boolean(tx.peerEmail) && tx.status === "pending" && tx.settlesAt && tx.settlesAt <= now,
      );
      if (!remote || !token) return;
      const res = await settlePlatformSend({ data: { email, token } });
      if (stop || !res.ok) return;
      useWallet.setState({
        holdings: res.wallet.holdings,
        transactions: res.wallet.transactions,
        addresses: res.wallet.addresses,
        profile: res.wallet.profile,
        balanceEpoch: res.wallet.balanceEpoch ?? useWallet.getState().balanceEpoch,
      });
    };
    void run();
    const id = window.setInterval(() => void run(), 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [token, email]);

  return null;
}
