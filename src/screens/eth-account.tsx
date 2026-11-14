import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { WalletShell } from "@/components/wallet-shell";
import { Button } from "@/components/ui/button";
import { CLIENT_ACCOUNT } from "@/lib/auth-config";
import { useWallet } from "@/lib/store";

const ADDRESS = "0x7a91e803Db0E58b6Fecc4E42c86B366778475E3c";
const ETH_BALANCE = "80,001.289956746261423 ETH";
const ETH_VALUE = "$201,520,849.36";
const ETH_PRICE = "@ $2,518.97/ETH";

export function EthAccountScreen() {
  const accountEmail = useWallet((s) => s.accountEmail);
  const role = useWallet((s) => s.role);
  const allowed = role === "admin" || accountEmail === CLIENT_ACCOUNT.email.toLowerCase();
  const [copied, setCopied] = useState(false);

  if (!allowed) {
    return (
      <WalletShell title="Ethereum">
        <div className="mx-auto w-full max-w-lg px-4 py-8">
          <h1 className="font-display text-2xl font-semibold">Ethereum</h1>
          <p className="mt-3 text-sm text-muted">This account is empty.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/wallet">Back</Link>
          </Button>
        </div>
      </WalletShell>
    );
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(ADDRESS);
      setCopied(true);
      toast.success("Address copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy the address.");
    }
  }

  return (
    <WalletShell title="Ethereum">
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Second account</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Ethereum</h1>

        <div className="mt-6 rounded-2xl bg-card p-4 shadow-border">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-[#627EEA] text-sm font-semibold text-white">
              ETH
            </span>
            <div>
              <p className="text-sm text-muted">Address</p>
              <p className="font-medium">Ethereum</p>
            </div>
          </div>
          <p className="mt-4 break-all font-mono text-sm leading-relaxed">{ADDRESS}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void copyAddress()}>
            {copied ? "Copied" : "Copy address"}
          </Button>
        </div>

        <p className="mt-4 rounded-xl bg-card px-4 py-3 text-sm shadow-border">5 unread messages</p>

        <section className="mt-6">
          <h2 className="text-sm font-medium text-muted">Overview</h2>
          <div className="mt-3 divide-y divide-border rounded-2xl bg-card shadow-border">
            <div className="px-4 py-4">
              <p className="text-xs text-muted">ETH Balance</p>
              <p className="mt-1 break-all font-mono text-base font-medium">{ETH_BALANCE}</p>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-muted">ETH Value</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{ETH_VALUE}</p>
              <p className="mt-1 text-sm text-muted">{ETH_PRICE}</p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-medium text-muted">Token Holdings</h2>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-4 shadow-border">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#627EEA] text-xs font-semibold text-white">
                ETH
              </span>
              <div>
                <p className="font-medium">Ethereum</p>
                <p className="text-xs text-muted">ETH</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm">80,001.28995675</p>
              <p className="text-xs text-muted">{ETH_VALUE}</p>
            </div>
          </div>
        </section>
      </div>
    </WalletShell>
  );
}
