import { useEffect, useMemo, useState } from "react";
import { adminProof } from "@/lib/admin-proof";
import { loadLive, pageName } from "@/lib/live";

type Person = {
  sessionId: string;
  at: number;
  role: string;
  who: string;
  path: string;
  device: string;
  browser: string;
  os: string;
  viewport: string;
  lang: string;
  mode: string;
  startedAt: number;
  pageAt: number;
  scenario: string;
  email: string;
};

type Item = {
  id: number;
  at: number;
  sessionId: string;
  role: string;
  who: string;
  path: string;
  device: string;
  kind: string;
  label: string;
};

type Hour = { actions: number; opens: number; taps: number; sessions: number };
type Filter = "all" | "open" | "tap" | "action";

function clock(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ago(at: number, now: number) {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function span(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${total % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function tone(item: Item): "money" | "danger" | "action" | "open" | "tap" {
  if (/fail|stopped|wrong|not enough/i.test(item.label)) return "danger";
  if (/^(Sent |Started send |Swapped |Bought |Signed in|Viewing receive|Copied receive)/.test(item.label)) return "money";
  if (item.kind === "action") return "action";
  if (item.kind === "open") return "open";
  return "tap";
}

function ActivityBody({ label }: { label: string }) {
  const lines = label.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <div className="mt-1 grid gap-1">
      {lines.map((line, index) => {
        const field = line.match(/^(To|From|Hash|Network|Fee|For|Card ending):\s*(.*)$/i);
        if (!field) {
          return (
            <p key={index} className={index === 0 ? "text-sm font-medium leading-snug" : "text-sm leading-snug break-all"}>
              {line}
            </p>
          );
        }
        return (
          <p key={index} className="font-mono text-[12px] leading-relaxed break-all">
            <span className="text-muted">{field[1]}: </span>
            {field[2]}
          </p>
        );
      })}
    </div>
  );
}

const TONE_CLASS = {
  money: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
  action: "bg-warning/15 text-warning",
  open: "bg-accent-soft text-primary",
  tap: "bg-foreground/8 text-muted",
  admin: "bg-accent-soft text-primary",
  client: "bg-success/15 text-success",
  guest: "bg-foreground/8 text-muted",
} as const;

function Pill({ children, tone: name }: { children: string; tone: keyof typeof TONE_CLASS }) {
  return (
    <span className={`inline-flex h-5 shrink-0 items-center rounded px-1.5 font-mono text-[10px] tracking-wide uppercase ${TONE_CLASS[name]}`}>
      {children}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-3 shadow-border">
      <p className="text-[10px] font-medium tracking-[0.16em] text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function SessionCard({
  person,
  now,
  live,
  selected,
  mine,
  onPick,
}: {
  person: Person;
  now: number;
  live: boolean;
  selected: boolean;
  mine: boolean;
  onPick: () => void;
}) {
  const role = person.role === "admin" || person.role === "client" || person.role === "guest" ? person.role : "guest";
  const facts = [person.device, person.browser, person.os].filter(Boolean).join(" · ");
  const meta = [person.mode, person.viewport, person.lang].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onPick}
      className={`w-full rounded-xl bg-card px-3 py-3 text-left shadow-border ${selected ? "shadow-[0_0_0_1px_var(--color-primary)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{person.who}</p>
            <Pill tone={role}>{role}</Pill>
            {person.scenario ? <Pill tone="action">{person.scenario}</Pill> : null}
            {mine ? <Pill tone="tap">You</Pill> : null}
          </div>
          {person.email && person.email !== person.who ? (
            <p className="mt-0.5 truncate text-xs text-muted">{person.email}</p>
          ) : null}
        </div>
        <span className={`shrink-0 text-[11px] ${live ? "text-success" : "text-muted"}`}>{live ? "Live" : ago(person.at, now)}</span>
      </div>
      <p className="mt-2 text-sm">{pageName(person.path)}</p>
      <p className="truncate font-mono text-[11px] text-muted">{person.path}</p>
      <p className="mt-2 text-xs text-muted">{facts || person.device}</p>
      {meta ? <p className="mt-0.5 text-xs text-muted">{meta}</p> : null}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {person.pageAt ? <span>On this page {span(now - person.pageAt)}</span> : null}
        {person.startedAt ? <span>Session {span(now - person.startedAt)}</span> : null}
        <span className="font-mono">#{person.sessionId.slice(0, 6)}</span>
      </div>
    </button>
  );
}

export function LiveBoard() {
  const [online, setOnline] = useState<Person[]>([]);
  const [recent, setRecent] = useState<Person[]>([]);
  const [events, setEvents] = useState<Item[]>([]);
  const [hour, setHour] = useState<Hour>({ actions: 0, opens: 0, taps: 0, sessions: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState("");
  const [hideMine, setHideMine] = useState(false);
  const mine = typeof window === "undefined" ? "" : window.sessionStorage.getItem("trust-live-sid") || "";

  useEffect(() => {
    if (paused) return;
    let stop = false;
    const pull = async () => {
      try {
        const res = await loadLive({ data: { proof: adminProof() } });
        if (stop) return;
        if (!res.ok) {
          setError("Only the admin can watch the platform.");
          return;
        }
        setError("");
        setNow(res.now);
        setOnline(res.online);
        setRecent(res.recent);
        setEvents(res.events);
        setHour(res.hour);
      } catch {
        if (!stop) setError("Could not reach the live view.");
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [paused]);

  const people = hideMine ? online.filter((p) => p.sessionId !== mine) : online;
  const left = hideMine ? recent.filter((p) => p.sessionId !== mine) : recent;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((item) => {
      if (hideMine && item.sessionId === mine) return false;
      if (focus && item.sessionId !== focus) return false;
      if (filter !== "all" && item.kind !== filter) return false;
      if (!q) return true;
      return `${item.who} ${item.label} ${item.path} ${item.device} ${pageName(item.path)}`.toLowerCase().includes(q);
    });
  }, [events, filter, focus, hideMine, mine, query]);

  const focused = [...online, ...recent].find((p) => p.sessionId === focus);

  function pick(id: string) {
    setFocus((current) => (current === id ? "" : id));
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "action", label: "Actions" },
    { id: "open", label: "Pages" },
    { id: "tap", label: "Taps" },
  ];

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${paused ? "bg-warning" : "bg-success"}`} />
          <span className={`font-mono text-[11px] tracking-[0.16em] ${paused ? "text-warning" : "text-success"}`}>
            {paused ? "PAUSED" : "LIVE"}
          </span>
          <span className="text-xs text-muted">{paused ? "Updates are held" : `Synced ${clock(now)}`}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHideMine((v) => !v)}
            className="h-8 rounded-full px-3 text-xs text-muted shadow-border"
          >
            {hideMine ? "Show my session" : "Hide my session"}
          </button>
          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            className="h-8 rounded-full px-3 text-xs text-foreground shadow-border"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Online" value={people.length} hint="Active in the last 15 seconds" />
        <Stat label="Recent" value={left.length} hint="Left within 30 minutes" />
        <Stat label="Actions" value={hour.actions} hint="Sends, swaps, logins, 1 hour" />
        <Stat label="Sessions" value={hour.sessions} hint={`${hour.opens} pages · ${hour.taps} taps`} />
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.15fr)]">
        <section className="grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">Sessions</h2>
            <span className="text-[11px] text-muted">Tap a session to isolate it</span>
          </div>
          {people.length === 0 ? (
            <p className="rounded-xl bg-card px-3 py-4 text-sm text-muted shadow-border">Nobody is on the platform right now.</p>
          ) : (
            people.map((person) => (
              <SessionCard
                key={person.sessionId}
                person={person}
                now={now}
                live
                selected={focus === person.sessionId}
                mine={person.sessionId === mine}
                onPick={() => pick(person.sessionId)}
              />
            ))
          )}
          {left.length > 0 ? (
            <>
              <h3 className="pt-2 text-xs font-medium tracking-wide text-muted uppercase">Left recently</h3>
              {left.map((person) => (
                <SessionCard
                  key={person.sessionId}
                  person={person}
                  now={now}
                  live={false}
                  selected={focus === person.sessionId}
                  mine={person.sessionId === mine}
                  onPick={() => pick(person.sessionId)}
                />
              ))}
            </>
          ) : null}
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">Activity</h2>
            <span className="text-[11px] text-muted">{shown.length} shown</span>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by person, page, or action"
            className="mt-3 h-10 w-full rounded-md bg-input px-3 text-sm text-foreground shadow-border outline-none focus-visible:shadow-[0_0_0_1px_var(--color-primary)]"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={
                  filter === item.id
                    ? "h-8 rounded-full bg-foreground px-3 text-xs text-background"
                    : "h-8 rounded-full px-3 text-xs text-muted shadow-border"
                }
              >
                {item.label}
              </button>
            ))}
            {focus ? (
              <button
                type="button"
                onClick={() => setFocus("")}
                className="h-8 rounded-full bg-accent-soft px-3 text-xs text-primary"
              >
                {focused ? focused.who : "Session"} · clear
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-muted">Passwords and the secret phrase are never recorded.</p>

          {shown.length === 0 ? (
            <p className="mt-3 rounded-xl bg-card px-3 py-4 text-sm text-muted shadow-border">No matching activity yet.</p>
          ) : (
            <ul className="mt-3 grid max-h-[70dvh] gap-1.5 overflow-y-auto overscroll-contain pr-0.5">
              {shown.map((item) => (
                <li key={item.id} className="rounded-lg bg-card px-3 py-2 shadow-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill tone={tone(item)}>{tone(item) === "money" ? "money" : item.kind}</Pill>
                        <span className="truncate text-xs text-muted">{item.who}</span>
                      </div>
                      <ActivityBody label={item.label} />
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted">{clock(item.at)}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted">
                    {pageName(item.path)}
                    {item.device ? ` · ${item.device}` : ""} · {item.path}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
