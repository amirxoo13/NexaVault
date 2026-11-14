import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Check, ScanLine } from "lucide-react";
import { QrScan } from "@/components/qr-scan";
import { CoinIcon } from "@/components/coin-icon";
import { SendNotice } from "@/components/send-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletShell } from "@/components/wallet-shell";
import { useMarketMap } from "@/hooks/use-markets";
import { validateAddress } from "@/lib/addresses";
import { COIN_BY_ID, usdPrice } from "@/lib/coins";
import { formatAmount, formatUsdFull, shortAddress } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useSite } from "@/lib/site-store";
import { holdingAmount, useWallet } from "@/lib/store";
import { CLIENT_ACCOUNT } from "@/lib/auth-config";
import { lookupPlatformUser, settlePlatformSend, startPlatformSend } from "@/lib/transfer";
import { SEND_PIPELINE_MS, SEND_STEPS, claimNotice, sendStepIndex } from "@/lib/send-pipeline";
import { notifyWalletMove } from "@/lib/push";
import { setHoldPush } from "@/lib/cloud-sync";
import { requestDeviceAuth } from "@/lib/device-lock";
import { track } from "@/lib/live";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const QR_COIN: Record<string, string> = {
  bitcoin: "bitcoin",
  btc: "bitcoin",
  ethereum: "ethereum",
  eth: "ethereum",
  tron: "tron",
  trx: "tron",
  solana: "solana",
  sol: "solana",
  ripple: "ripple",
  xrp: "ripple",
  dogecoin: "dogecoin",
  doge: "dogecoin",
  litecoin: "litecoin",
  ltc: "litecoin",
  bnb: "binancecoin",
  polygon: "matic-network",
  matic: "matic-network",
  ton: "the-open-network",
};

function parsePaymentQr(raw: string) {
  const text = raw.trim();
  const uri = text.match(/^([a-z][a-z0-9+.-]*):([^?\s]+)(\?.*)?$/i);
  if (!uri) return { address: text, amount: "", coinId: "" };
  const params = new URLSearchParams((uri[3] ?? "").replace(/^\?/, ""));
  return {
    address: decodeURIComponent(uri[2]),
    amount: params.get("amount") ?? params.get("value") ?? "",
    coinId: QR_COIN[uri[1].toLowerCase()] ?? "",
  };
}

export function WalletSendScreen() {
  const holdings = useWallet((s) => s.holdings);
  const addresses = useWallet((s) => s.addresses);
  const accountEmail = useWallet((s) => s.accountEmail);
  const accountToken = useWallet((s) => s.accountToken);
  const role = useWallet((s) => s.role);
  const copy = t();
  const site = useSite();
  const markets = useMarketMap();
  const navigate = useNavigate();
  const [noticeOpen, setNoticeOpen] = useState(
    role === "client" && accountEmail.toLowerCase() === CLIENT_ACCOUNT.email.toLowerCase(),
  );

  const [coinId, setCoinId] = useState("tether");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [scanStream, setScanStream] = useState<MediaStream | null>(null);
  const [scanError, setScanError] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "confirming" | "done">("form");
  const [pipelineStart, setPipelineStart] = useState(0);
  const [pipelineEnd, setPipelineEnd] = useState(0);
  const [pipelineNow, setPipelineNow] = useState(0);
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [peer, setPeer] = useState("");
  const [peerAddress, setPeerAddress] = useState("");
  const [busy, setBusy] = useState(false);

  function stopScan() {
    scanStream?.getTracks().forEach((tr) => tr.stop());
    setScanStream(null);
  }

  const scanStreamRef = useRef<MediaStream | null>(null);
  scanStreamRef.current = scanStream;
  useEffect(() => () => scanStreamRef.current?.getTracks().forEach((tr) => tr.stop()), []);

  async function openScan() {
    setScanError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("This browser cannot open the camera.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      setScanStream(stream);
    } catch {
      setScanError("Allow camera access to scan the destination QR code.");
    }
  }

  function applyScan(raw: string) {
    const parsed = parsePaymentQr(raw);
    if (parsed.coinId && holdings.some((holding) => holding.id === parsed.coinId)) setCoinId(parsed.coinId);
    setTo(parsed.address);
    setPeer("");
    setPeerAddress("");
    if (parsed.amount && Number(parsed.amount) > 0) setAmount(parsed.amount);
    setError("");
    track("action", `Scanned destination QR ${parsed.address}`);
    stopScan();
  }

  const coin = COIN_BY_ID[coinId];
  const avail = holdingAmount(holdings, coinId);
  const price = usdPrice(coinId, markets[coinId]?.price);
  const amt = Number(amount);
  const fee = coin?.fee ?? 0;
  const usd = (Number.isFinite(amt) ? amt : 0) * price;

  const inside = isEmail(to);
  const canContinue = useMemo(() => {
    if (!coin) return false;
    if (!inside && !validateAddress(to, coin.kind)) return false;
    if (!Number.isFinite(amt) || amt <= 0) return false;
    if (amt + fee > avail + 1e-12) return false;
    return true;
  }, [coin, to, inside, amt, fee, avail]);

  const pipelineRef = useRef({ peer: "", hash: "", email: "", token: "", symbol: "", amount: 0, usd: 0, to: "", network: "" });
  pipelineRef.current = {
    peer,
    hash,
    email: accountEmail,
    token: accountToken,
    symbol: coin?.symbol ?? "",
    amount: amt,
    usd,
    to: peerAddress || to.trim(),
    network: coin?.chainName ?? "",
  };

  useEffect(() => {
    if (step !== "confirming" || !pipelineEnd) return;
    let started = false;
    const id = window.setInterval(() => {
      const now = Date.now();
      setPipelineNow(now);
      if (now < pipelineEnd || started) return;
      started = true;
      window.clearInterval(id);
      void (async () => {
        const cur = pipelineRef.current;
        if (cur.peer) {
          const res = await settlePlatformSend({ data: { email: cur.email, token: cur.token } });
          if (res.ok) {
            useWallet.setState({
              holdings: res.wallet.holdings,
              transactions: res.wallet.transactions,
              addresses: res.wallet.addresses,
              profile: res.wallet.profile,
              balanceEpoch: res.wallet.balanceEpoch ?? useWallet.getState().balanceEpoch,
            });
          }
        } else if (cur.hash) {
          useWallet.setState((s) => ({
            transactions: s.transactions.map((tx) =>
              tx.hash === cur.hash && tx.status === "pending" ? { ...tx, status: "confirmed" as const } : tx,
            ),
          }));
          if (claimNotice(cur.hash)) {
            void notifyWalletMove({
              data: {
                email: cur.email,
                token: cur.token,
                direction: "sent",
                symbol: cur.symbol,
                amount: cur.amount,
                usd: cur.usd,
                counterparty: cur.to,
                network: cur.network,
                hash: cur.hash,
              },
            }).catch(() => undefined);
          }
        }
        setStep("done");
      })();
    }, 400);
    return () => window.clearInterval(id);
  }, [step, pipelineEnd]);

  async function goConfirm() {
    if (!coin) return;
    const dest = to.trim();
    const emailDest = isEmail(dest);
    if (!emailDest && !validateAddress(dest, coin.kind)) {
      setError(copy.wallet.invalidAddress);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0 || amt + fee > avail + 1e-12) {
      setError(copy.wallet.insufficient);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const found = await lookupPlatformUser({
        data: { email: accountEmail, token: accountToken, to: dest, coinId },
      });
      if (!found.ok) {
        if (emailDest) {
          setError("Sign out and sign in again, then send.");
          return;
        }
        setPeer("");
        setPeerAddress("");
      } else {
        if (emailDest && !found.found) {
          setError("No user on this platform uses that email.");
          return;
        }
        if (found.found && found.self) {
          setError("You can't send to yourself.");
          return;
        }
        if (found.found && !found.address) {
          setError("That user has no address on this network.");
          return;
        }
        setPeer(found.found ? found.email : "");
        setPeerAddress(found.found ? found.address : "");
      }
      track(
        "action",
        [
          `Started send ${formatAmount(amt)} ${coin.symbol} · ${formatUsdFull(usd)}`,
          `Network: ${coin.chainName}`,
          `To: ${found.ok && found.found ? found.address : dest}`,
          found.ok && found.found ? `User: ${found.email}` : "",
          `From: ${addresses[coin.chain] ?? ""}`,
          `Fee: ${formatAmount(fee)} ${coin.symbol}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      setStep("confirm");
    } catch {
      if (emailDest) {
        setError("Could not look up that user.");
        return;
      }
      setPeer("");
      setPeerAddress("");
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  }

  async function beginConfirming() {
    const ok = await requestDeviceAuth("transaction");
    if (!ok) return;
    void runRealSend();
  }

  async function runRealSend() {
    if (!coin) return;
    setBusy(true);
    setError("");
    setStep("confirming");
    const started = Date.now();
    const ends = started + SEND_PIPELINE_MS;
    try {
      if (peer) {
        setHoldPush(true);
        const res = await startPlatformSend({
          data: { email: accountEmail, token: accountToken, coinId, amount: amt, to: peer, usdValue: usd },
        });
        if (!res.ok) {
          const message =
            res.error === "insufficient"
              ? copy.wallet.insufficient
              : res.error === "self"
                ? "You can't send to yourself."
                : res.error === "user"
                  ? "That user is not on this platform."
                  : res.error === "auth"
                    ? "Sign out and sign in again, then send."
                    : "Could not send.";
          setError(message);
          setStep("form");
          return;
        }
        useWallet.setState({
          holdings: res.wallet.holdings,
          transactions: res.wallet.transactions,
          addresses: res.wallet.addresses,
          profile: res.wallet.profile,
          balanceEpoch: res.wallet.balanceEpoch ?? useWallet.getState().balanceEpoch,
        });
        setHash(res.hash);
        setPipelineStart(res.startedAt);
        setPipelineEnd(res.settlesAt);
        setPipelineNow(Date.now());
        return;
      }
      const reserved = useWallet.getState().debit(coinId, amt + fee);
      if (!reserved) {
        setError(copy.wallet.insufficient);
        setStep("form");
        return;
      }
      const tx = useWallet.getState().addTx({
        type: "send",
        status: "pending",
        coinId,
        symbol: coin.symbol,
        amount: amt,
        usdValue: usd,
        fromAddress: addresses[coin.chain],
        toAddress: to.trim(),
        fee,
        feeSymbol: coin.symbol,
        settlesAt: ends,
      });
      setHash(tx.hash);
      setPipelineStart(started);
      setPipelineEnd(ends);
      setPipelineNow(started);
      track(
        "action",
        [
          `Sent ${formatAmount(amt)} ${coin.symbol} · ${formatUsdFull(usd)}`,
          `Network: ${coin.chainName}`,
          `To: ${to.trim()}`,
          `From: ${addresses[coin.chain] ?? ""}`,
          `Fee: ${formatAmount(fee)} ${coin.symbol}`,
          `Hash: ${tx.hash}`,
        ].join("\n"),
      );
    } catch {
      setError("Could not send.");
      setStep("form");
    } finally {
      setHoldPush(false);
      setBusy(false);
    }
  }

  const currentStep = sendStepIndex(pipelineStart, pipelineEnd, pipelineNow || Date.now());
  const progressPct = Math.min(100, Math.round(((currentStep + 1) / SEND_STEPS.length) * 100));

  return (
    <WalletShell title={copy.wallet.send}>
      <SendNotice open={noticeOpen} onContinue={() => setNoticeOpen(false)} />
      {scanStream ? <QrScan stream={scanStream} onClose={stopScan} onResult={applyScan} /> : null}
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <div className="rounded-3xl bg-card p-6 shadow-float shadow-border">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">NEXAVAULT ROUTING</p>
              <h1 className="mt-1 font-display text-2xl font-bold">{copy.wallet.send}</h1>
            </div>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-primary">
              <ArrowUpRight className="size-5" />
            </span>
          </div>

          {step === "form" ? (
            <div className="mt-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label>Asset</Label>
                <select
                  value={coinId}
                  onChange={(e) => setCoinId(e.target.value)}
                  className="h-12 rounded-xl bg-input px-3.5 text-sm font-medium text-foreground shadow-border outline-none"
                >
                  {holdings.map((h) => {
                    const c = COIN_BY_ID[h.id];
                    if (!c) return null;
                    return (
                      <option key={h.id} value={h.id}>
                        {c.name} · {formatAmount(h.amount)} {c.symbol}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>{copy.wallet.to}</Label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-semibold text-primary"
                    onClick={() => void openScan()}
                  >
                    <ScanLine className="size-3.5" />
                    Scan QR
                  </button>
                </div>
                <Input
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPeer("");
                    setPeerAddress("");
                  }}
                  placeholder="Email or wallet address"
                  autoComplete="off"
                />
                <p className="text-xs text-muted">Send to a wallet address, or to another user's email on this platform.</p>
                {scanError ? <p className="text-sm text-danger">{scanError}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>{copy.wallet.amount}</Label>
                  <button
                    type="button"
                    className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs font-semibold text-primary"
                    onClick={() => setAmount(String(Math.max(0, avail - fee)))}
                  >
                    {copy.wallet.max}
                  </button>
                </div>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                />
                <p className="text-xs text-muted">
                  {copy.wallet.available}: {formatAmount(avail)} {coin?.symbol} · {copy.wallet.networkFee}{" "}
                  {formatAmount(fee)} {coin?.symbol}
                </p>
              </div>
              {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
              <Button variant="solid" size="lg" className="w-full rounded-2xl" disabled={!canContinue || busy} onClick={() => void goConfirm()}>
                {copy.wallet.continue}
              </Button>
            </div>
          ) : null}

          {step === "confirm" && coin ? (
            <div className="mt-6">
              <h2 className="font-display text-xl font-bold tracking-tight">{site.sendSureTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{site.sendSureBody}</p>
              <div className="mt-5 rounded-2xl bg-input p-5 shadow-border">
                <div className="flex items-center gap-3.5">
                  <CoinIcon id={coin.id} symbol={coin.symbol} size={42} />
                  <div>
                    <p className="font-mono text-xs text-muted">{copy.wallet.amount}</p>
                    <p className="font-display text-2xl font-bold tabular">
                      {formatAmount(amt)} {coin.symbol}
                    </p>
                    <p className="font-mono text-xs text-primary">{formatUsdFull(usd)}</p>
                  </div>
                </div>
                <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{copy.wallet.to}</dt>
                    <dd className="max-w-[14rem] text-end font-mono text-xs break-all">{peerAddress || to.trim()}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{copy.wallet.from}</dt>
                    <dd className="font-mono text-xs">{shortAddress(addresses[coin.chain] ?? "", 10, 8)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{copy.wallet.networkFee}</dt>
                    <dd className="font-mono tabular">
                      {formatAmount(fee)} {coin.symbol}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="mt-6 flex gap-3">
                <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setStep("form")}>
                  {site.sendSureCancel}
                </Button>
                <Button variant="solid" className="flex-1 rounded-2xl" disabled={busy} onClick={beginConfirming}>
                  {site.sendSureOk}
                </Button>
              </div>
            </div>
          ) : null}

          {step === "confirming" ? (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Sending</h2>
                <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-xs font-semibold text-primary tabular">
                  Step {Math.min(SEND_STEPS.length, currentStep + 1)} / {SEND_STEPS.length}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">The transfer is moving through the network. Each step is saved.</p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-input">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[#06b6d4] transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <ol className="mt-6 flex flex-col gap-2.5">
                {SEND_STEPS.map((label, index) => {
                  const done = index < currentStep;
                  const active = index === currentStep;
                  return (
                    <li
                      key={label}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                        active ? "bg-accent-soft/60 shadow-border" : "bg-input/60"
                      }`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                          done
                            ? "bg-success/20 text-success"
                            : active
                              ? "bg-primary text-primary-fg animate-pulse"
                              : "bg-card text-muted"
                        }`}
                      >
                        {done ? <Check className="size-3.5" /> : index + 1}
                      </span>
                      <span className={done || active ? "font-medium text-foreground" : "text-muted"}>{label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="mt-8 flex flex-col items-center py-4 text-center">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-success/15 text-success shadow-border">
                <Check className="size-8" />
              </span>
              <h2 className="mt-5 font-display text-xl font-bold">{copy.wallet.success}</h2>
              <p className="mt-2 max-w-xs break-all rounded-xl bg-input p-3 font-mono text-xs text-muted">{hash}</p>
              <Button asChild variant="solid" className="mt-7 w-full rounded-2xl">
                <Link to="/wallet">{copy.wallet.done}</Link>
              </Button>
              <button
                type="button"
                className="mt-3 text-sm font-medium text-primary hover:underline"
                onClick={() => void navigate({ to: "/wallet/activity" })}
              >
                {copy.wallet.activity}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </WalletShell>
  );
}
