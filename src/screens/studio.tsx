import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CoinIcon } from "@/components/coin-icon";
import { LogoWord } from "@/components/logo";
import { PageBack } from "@/components/page-back";
import { COINS } from "@/lib/coins";
import { readImageFile } from "@/lib/image-file";
import { SITE_TEXT_FIELDS, useSite, type SiteContent } from "@/lib/site-store";
import { CLIENT_ACCOUNT, SCENARIO_CODES, type ScenarioCode } from "@/lib/auth-config";
import { WALLET_CODES } from "@/lib/addresses";
import { loadAdminWallet, saveAdminWallet } from "@/lib/admin-wallet";
import { ensureWalletAddresses, holdingAmount, useWallet, type Profile } from "@/lib/store";
import { formatAmount, formatDuration } from "@/lib/format";
import { adminProof } from "@/lib/admin-proof";
import { sendAdminNotice, notifyWalletMove } from "@/lib/push";
import { LiveBoard } from "@/components/live-board";
import { saveCloudNow, useCloud } from "@/lib/cloud-sync";
import { listAccounts, removeAccount } from "@/lib/accounts";
import { useLoginWindow } from "@/lib/login-window";

type Tab = "live" | "brand" | "pages" | "images" | "profile" | "balances" | "notices" | "notify" | "accounts";

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {value ? (
          <button
            type="button"
            className="text-xs text-muted hover:text-foreground"
            onClick={() => onChange("")}
          >
            Clear
          </button>
        ) : null}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md bg-input px-3 py-2 text-sm text-foreground shadow-border outline-none focus-visible:shadow-[0_0_0_1px_var(--color-primary)]"
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ImagePick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onChange(await readImageFile(file));
      toast.success("Image saved");
    } catch {
      toast.error("Could not read that image");
    }
  }
  return (
    <div>
      <Label>{label}</Label>
      {value ? (
        <img src={value} alt="" className="mt-2 max-h-40 w-full rounded-lg object-contain bg-card" />
      ) : (
        <p className="mt-2 text-xs text-muted">No image yet — default artwork is used.</p>
      )}
      <div className="mt-2 flex gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-md bg-card px-3 text-sm shadow-border">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e)} />
        </label>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TextGroup({
  group,
  fields,
  site,
  set,
}: {
  group: string;
  fields: typeof SITE_TEXT_FIELDS;
  site: SiteContent;
  set: <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => void;
}) {
  const rows = fields.filter((f) => f.group === group);
  if (!rows.length) return null;
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-lg font-semibold">{group}</h2>
      {rows.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          value={String(site[f.key] ?? "")}
          multiline={f.multiline}
          onChange={(v) => set(f.key, v as SiteContent[typeof f.key])}
        />
      ))}
    </section>
  );
}

export function StudioScreen() {
  const [tab, setTab] = useState<Tab>("live");
  const [query, setQuery] = useState("");
  const site = useSite();
  const patch = useSite((s) => s.patch);
  const reset = useSite((s) => s.reset);
  const cloudPhase = useCloud((s) => s.phase);
  const lastSaved = useCloud((s) => s.lastSaved);
  const profile = useWallet((s) => s.profile);
  const accountEmail = useWallet((s) => s.accountEmail);
  const accountToken = useWallet((s) => s.accountToken);
  const setProfile = useWallet((s) => s.setProfile);
  const holdings = useWallet((s) => s.holdings);
  const setHolding = useWallet((s) => s.setHolding);
  const simulateIncoming = useWallet((s) => s.simulateIncoming);
  const transactions = useWallet((s) => s.transactions);
  const cancelSwap = useWallet((s) => s.cancelSwap);
  const [creditId, setCreditId] = useState("ethereum");
  const [creditAmt, setCreditAmt] = useState("0.05");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    patch({ [key]: value });
    saveCloudNow();
  }

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return SITE_TEXT_FIELDS.filter((f) => {
      const val = String(site[f.key] ?? "").toLowerCase();
      return f.label.toLowerCase().includes(q) || f.group.toLowerCase().includes(q) || val.includes(q);
    });
  }, [q, site]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "brand", label: "Brand" },
    { id: "pages", label: "Page text" },
    { id: "images", label: "Images" },
    { id: "profile", label: "Client" },
    { id: "balances", label: "Balances" },
    { id: "notices", label: "T20 / F20 / K20" },
    { id: "notify", label: "Notify" },
    { id: "accounts", label: "Accounts" },
  ];

  const brandGroups = ["Brand"];
  const pageGroups = ["Homepage hero", "Stats", "Assets + security + footer", "Login + inner pages"];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-[var(--safe-top)] z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <PageBack to="/wallet" />
          <LogoWord />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/wallet" className="text-muted hover:text-foreground">
            Wallet
          </Link>
          <Link to="/" className="text-muted hover:text-foreground">
            Site
          </Link>
        </div>
      </header>

      <div className={tab === "live" && !q ? "mx-auto max-w-6xl px-4 py-6" : "mx-auto max-w-3xl px-4 py-8"}>
        <h1 className="font-display text-2xl font-semibold">Control panel</h1>
        {tab === "live" && !q ? (
          <p className="mt-1 text-sm text-muted">Every open session, page, and action on the platform.</p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {cloudPhase === "local"
              ? "Could not reach the shared copy. Edits are only on this device until it reconnects."
              : cloudPhase === "boot"
                ? "Connecting to the shared copy…"
                : lastSaved
                  ? "Saved for every browser and phone. Other devices pick it up within a few seconds."
                  : "Edits save for every browser. Phones and other computers load the same text, images, profile, and balances."}
          </p>
        )}

        {tab === "live" && !q ? null : (
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all site text…"
            className="mt-5"
          />
        )}

        {q ? (
          <div className="mt-6 grid gap-4">
            {matches.length === 0 ? (
              <p className="text-sm text-muted">No matching fields.</p>
            ) : (
              matches.map((f) => (
                <Field
                  key={f.key}
                  label={`${f.group} · ${f.label}`}
                  value={String(site[f.key] ?? "")}
                  multiline={f.multiline}
                  onChange={(v) => set(f.key, v as SiteContent[typeof f.key])}
                />
              ))
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setTab(x.id)}
                  className={
                    tab === x.id
                      ? "h-10 rounded-full bg-foreground px-4 text-sm text-background"
                      : "h-10 rounded-full px-4 text-sm text-muted shadow-border"
                  }
                >
                  {x.label}
                </button>
              ))}
            </div>

            {tab === "live" ? <LiveBoard /> : null}

            {tab === "brand" ? (
              <div className="mt-8 grid gap-6">
                {brandGroups.map((g) => (
                  <TextGroup key={g} group={g} fields={SITE_TEXT_FIELDS} site={site} set={set} />
                ))}
                <ImagePick label="Logo" value={site.logo} onChange={(v) => set("logo", v)} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    saveCloudNow();
                  }}
                >
                  Reset brand & page text to defaults
                </Button>
              </div>
            ) : null}

            {tab === "pages" ? (
              <div className="mt-8 grid gap-6">
                {pageGroups.map((g) => (
                  <TextGroup key={g} group={g} fields={SITE_TEXT_FIELDS} site={site} set={set} />
                ))}
              </div>
            ) : null}

            {tab === "images" ? (
              <div className="mt-8 grid gap-8">
                <ImagePick label="Logo" value={site.logo} onChange={(v) => set("logo", v)} />
                <ImagePick
                  label="Hero photo (replaces the phone mockup if set)"
                  value={site.heroImage}
                  onChange={(v) => set("heroImage", v)}
                />
                <ImagePick label="Assets / about photo" value={site.aboutImage} onChange={(v) => set("aboutImage", v)} />
                <ImagePick label="Security photo" value={site.securityImage} onChange={(v) => set("securityImage", v)} />
              </div>
            ) : null}

            {tab === "profile" ? (
              <div>
                <p className="mt-8 text-sm text-muted">
                  Client wallet. Every signed-in email sees this same profile. Fields and photos save immediately.
                </p>
                <ProfileEditor profile={profile} onSave={setProfile} />
              </div>
            ) : null}

            {tab === "balances" ? (
              <div className="mt-8 grid gap-4">
                {COINS.map((c) => (
                  <label key={c.id} className="flex items-center gap-3">
                    <CoinIcon id={c.id} symbol={c.symbol} size={28} />
                    <span className="w-24 text-sm leading-tight">
                      {c.symbol}
                      {c.id === "tether" ? <span className="block text-[10px] text-muted">TRC20</span> : null}
                    </span>
                    <Input
                      inputMode="decimal"
                      className="flex-1"
                      defaultValue={String(holdingAmount(holdings, c.id))}
                      key={`${c.id}-${holdingAmount(holdings, c.id)}`}
                      onBlur={(e) => setHolding(c.id, Number(e.target.value) || 0)}
                    />
                  </label>
                ))}
                <div className="mt-4 rounded-xl bg-card p-4 shadow-border">
                  <p className="text-sm font-medium">Swaps</p>
                  <p className="mt-1 text-xs text-muted">
                    Cancel returns the asset that was swapped. A pending Ethereum to Bitcoin swap will not pay out.
                  </p>
                  <div className="mt-3 space-y-3">
                    {transactions.filter((tx) => tx.type === "swap").length === 0 ? (
                      <p className="text-sm text-muted">No swaps yet.</p>
                    ) : (
                      transactions
                        .filter((tx) => tx.type === "swap")
                        .map((tx) => (
                          <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {formatAmount(tx.amount)} {tx.symbol} → {formatAmount(tx.toAmount ?? 0, 6)} {tx.toSymbol}
                              </p>
                              <p className="text-xs text-muted">
                                {tx.status === "pending" && tx.settlesAt
                                  ? `Pending · ${formatDuration(Math.max(0, tx.settlesAt - now))} left`
                                  : tx.status === "failed"
                                    ? "Cancelled"
                                    : "Completed"}
                              </p>
                            </div>
                            {tx.status !== "failed" ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const res = cancelSwap(tx.id);
                                  if (!res.ok) {
                                    toast.error(
                                      res.error === "spent"
                                        ? "The received asset was already spent, so this swap cannot be cancelled."
                                        : "Could not cancel this swap.",
                                    );
                                    return;
                                  }
                                  saveCloudNow();
                                  toast.success("Swap cancelled and the balance was returned");
                                }}
                              >
                                Cancel swap
                              </Button>
                            ) : null}
                          </div>
                        ))
                    )}
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-card p-4 shadow-border">
                  <p className="text-sm font-medium">Credit incoming (Receive)</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      value={creditId}
                      onChange={(e) => setCreditId(e.target.value)}
                      className="h-11 rounded-md bg-input px-3 text-sm text-foreground shadow-border"
                    >
                      {COINS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.symbol}
                        </option>
                      ))}
                    </select>
                    <Input
                      className="w-28"
                      inputMode="decimal"
                      value={creditAmt}
                      onChange={(e) => setCreditAmt(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="solid"
                      onClick={() => {
                        const n = Number(creditAmt);
                        if (!n) return;
                        const tx = simulateIncoming(creditId, n);
                        if (tx) {
                          const coin = COINS.find((item) => item.id === creditId);
                          void notifyWalletMove({
                            data: {
                              email: accountEmail,
                              token: accountToken,
                              direction: "received",
                              symbol: coin?.symbol ?? "",
                              amount: n,
                              usd: 0,
                              counterparty: tx.fromAddress ?? "",
                              network: coin?.chainName ?? "",
                              hash: tx.hash,
                            },
                          }).catch(() => undefined);
                        }
                        toast.success("Incoming transfer added");
                      }}
                    >
                      Credit
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "notices" ? (
              <div className="mt-8 grid gap-8">
                <TextGroup group="Send notices" fields={SITE_TEXT_FIELDS} site={site} set={set} />
                <TextGroup group="Send confirmation" fields={SITE_TEXT_FIELDS} site={site} set={set} />
                <p className="text-xs text-muted">
                  The send notice is chosen here, not by the person signing in. After they confirm the wallet address,
                  confirmations run for the minutes you set. The code box opens on the last confirmation. Use {"{current}"}{" "}
                  and {"{total}"} in the confirming line.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SCENARIO_CODES.map((code) => (
                    <Button
                      key={code}
                      type="button"
                      variant="outline"
                      onClick={() => {
                        useLoginWindow.getState().lockScenario(code);
                        useWallet.setState({ scenario: code });
                        saveCloudNow(true);
                        toast.success(`${code} is now the send notice`);
                      }}
                    >
                      Use {code}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "notify" ? <NotifyComposer /> : null}
            {tab === "accounts" ? <AccountsPanel /> : null}
          </>
        )}
      </div>
    </div>
  );
}

function NotifyComposer() {
  const [title, setTitle] = useState("NexaVault");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = body.trim();
    if (!text) {
      toast.error("Write the notification text first.");
      return;
    }
    setBusy(true);
    try {
      const res = await sendAdminNotice({
        data: { proof: adminProof(), title: title.trim(), body: text },
      });
      if (!res.ok) {
        toast.error("Only the admin can send notifications.");
        return;
      }
      if (res.devices === 0) {
        toast.error("No phone has alerts turned on yet.");
        return;
      }
      toast.success(`Sent to ${res.sent} of ${res.devices} phones.`);
      setBody("");
    } catch {
      toast.error("Could not send the notification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid max-w-lg gap-4">
      <p className="text-sm text-muted">
        This text is sent now as a phone notification to every device that turned alerts on.
      </p>
      <Field label="Title" value={title} onChange={setTitle} />
      <Field label="Message" value={body} onChange={setBody} multiline />
      <Button type="button" variant="solid" disabled={busy} onClick={() => void send()}>
        Send notification
      </Button>
    </div>
  );
}

function AccountsPanel() {
  const [rows, setRows] = useState<{ email: string; createdAt: number }[]>([]);
  const [error, setError] = useState("");
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const primary = CLIENT_ACCOUNT.email.toLowerCase();

  async function load() {
    const res = await listAccounts({ data: { proof: adminProof() } });
    if (!res.ok) {
      setError("Could not load accounts.");
      return;
    }
    setError("");
    setRows(res.accounts.filter((row) => row.email !== primary));
  }

  useEffect(() => {
    void load().catch(() => setError("Could not load accounts."));
  }, []);

  const people = [{ email: primary, createdAt: 0 }, ...rows];

  return (
    <div className="mt-8 grid gap-3">
      <p className="text-sm text-muted">Tap a user to edit that account. The main account is {primary}.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {people.map((row) => (
        <div key={row.email} className="rounded-lg bg-card shadow-border">
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <button type="button" className="min-w-0 text-start" onClick={() => setOpenEmail(openEmail === row.email ? null : row.email)}>
              <p className="truncate text-sm font-medium text-primary">{row.email}</p>
              <p className="text-[11px] text-muted">
                {row.email === primary ? "Main account" : new Date(row.createdAt).toLocaleString()}
              </p>
            </button>
            {row.email === primary ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void removeAccount({ data: { proof: adminProof(), email: row.email } }).then(() => load());
                }}
              >
                Remove
              </Button>
            )}
          </div>
          {openEmail === row.email ? <AccountEditor email={row.email} /> : null}
        </div>
      ))}
    </div>
  );
}

function AccountEditor({ email }: { email: string }) {
  const primary = CLIENT_ACCOUNT.email.toLowerCase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [scenario, setScenario] = useState<ScenarioCode | "">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadAdminWallet({ data: { proof: adminProof(), email } }).then((res) => {
      if (cancelled || !res.ok || !res.wallet) return;
      setProfile(res.wallet.profile);
      setAmounts(Object.fromEntries(COINS.map((coin) => [coin.id, String(holdingAmount(res.wallet.holdings, coin.id))])));
      setAddresses(Object.fromEntries(WALLET_CODES.map((code) => [code.chain, res.wallet.addresses?.[code.chain] ?? ""])));
      setScenario(res.wallet.scenario ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  function setField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!profile) return;
    setBusy(true);
    try {
      const holdings = COINS.map((coin) => ({ id: coin.id, amount: Math.max(0, Number(amounts[coin.id]) || 0) }));
      const res = await saveAdminWallet({
        data: {
          proof: adminProof(),
          email,
          profile,
          holdings,
          addresses,
          scenario: scenario || null,
        },
      });
      if (!res.ok || !res.wallet) {
        toast.error("Could not save this account.");
        return;
      }
      if (email === primary) {
        useWallet.setState({
          profile: res.wallet.profile,
          holdings: res.wallet.holdings,
          addresses: ensureWalletAddresses(res.wallet.addresses),
          scenario: res.wallet.scenario ?? null,
          balanceEpoch: res.wallet.balanceEpoch ?? 2,
        });
      }
      toast.success("Account saved");
    } catch {
      toast.error("Could not save this account.");
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <p className="px-3 pb-3 text-sm text-muted">Loading account…</p>;

  return (
    <div className="grid gap-4 border-t border-border px-3 py-4">
      <Field label="First name" value={profile.firstName} onChange={(v) => setField("firstName", v)} />
      <Field label="Last name" value={profile.lastName} onChange={(v) => setField("lastName", v)} />
      <Field label="Email on profile" value={profile.email} onChange={(v) => setField("email", v)} />
      <Field label="Address" value={profile.address} onChange={(v) => setField("address", v)} />
      <Field label="Phone" value={profile.phone} onChange={(v) => setField("phone", v)} />
      <Field label="Citizenship / national ID" value={profile.nationalId} onChange={(v) => setField("nationalId", v)} />
      <label className="flex flex-col gap-1.5">
        <Label>Notice</Label>
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value as ScenarioCode | "")}
          className="h-10 rounded-md bg-input px-3 text-sm"
        >
          <option value="">None</option>
          {SCENARIO_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Balances</p>
        {COINS.map((coin) => (
          <label key={coin.id} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
            <span>{coin.symbol}</span>
            <Input value={amounts[coin.id] ?? "0"} onChange={(e) => setAmounts((s) => ({ ...s, [coin.id]: e.target.value }))} />
          </label>
        ))}
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Wallet codes</p>
        {WALLET_CODES.map((code) => (
          <label key={code.chain} className="grid gap-1 text-sm">
            <span>{code.label}</span>
            <Input
              value={addresses[code.chain] ?? ""}
              onChange={(e) => setAddresses((s) => ({ ...s, [code.chain]: e.target.value }))}
              className="font-mono text-xs"
            />
          </label>
        ))}
      </div>
      <Button type="button" variant="solid" disabled={busy} onClick={() => void save()}>
        Save this account
      </Button>
    </div>
  );
}

function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const [form, setForm] = useState<Profile>(profile);
  useEffect(() => {
    setForm(profile);
  }, [profile]);
  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((s) => {
      const next = { ...s, [key]: value };
      queueMicrotask(() => {
        onSave(next);
        saveCloudNow();
      });
      return next;
    });
  }
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const photo = await readImageFile(file);
      set("licensePhoto", photo);
      toast.success("Photo saved");
    } catch {
      toast.error("Could not read that image");
    }
  }
  return (
    <form
      className="mt-8 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
        toast.success("Profile saved");
      }}
    >
      <Field label="First name" value={form.firstName} onChange={(v) => set("firstName", v)} />
      <Field label="Last name" value={form.lastName} onChange={(v) => set("lastName", v)} />
      <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
      <Field label="Address" value={form.address} onChange={(v) => set("address", v)} />
      <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
      <Field label="Citizenship / national ID" value={form.nationalId} onChange={(v) => set("nationalId", v)} />
      <div>
        <Label>ID / license photo</Label>
        {form.licensePhoto ? (
          <img src={form.licensePhoto} alt="" className="mt-2 max-h-48 rounded-lg object-contain" />
        ) : null}
        <div className="mt-2 flex gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md bg-card px-3 text-sm shadow-border">
            Upload
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e)} />
          </label>
          {form.licensePhoto ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => set("licensePhoto", null)}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <Button type="submit" variant="solid">
        Save profile
      </Button>
    </form>
  );
}
