import { getSql } from "@/lib/db";

async function ensureSchema() {
  const sql = await getSql();
  await sql.query(
    `create table if not exists activity_presence (
      session_id text primary key,
      at bigint not null,
      role text not null,
      who text not null,
      path text not null,
      device text not null
    )`,
  );
  await sql.query(
    `create table if not exists activity_log (
      id integer generated always as identity primary key,
      at bigint not null,
      session_id text not null,
      role text not null,
      who text not null,
      path text not null,
      kind text not null,
      label text not null
    )`,
  );
  const presenceCols = [
    "browser text not null default ''",
    "os text not null default ''",
    "viewport text not null default ''",
    "lang text not null default ''",
    "mode text not null default ''",
    "started_at bigint not null default 0",
    "page_at bigint not null default 0",
    "scenario text not null default ''",
    "email text not null default ''",
  ];
  for (const col of presenceCols) {
    await sql.query(`alter table activity_presence add column if not exists ${col}`);
  }
  await sql.query(`alter table activity_log add column if not exists device text not null default ''`);
}

export type LiveEvent = { kind: "open" | "tap" | "action"; label: string };

export type LiveWrite = {
  sessionId: string;
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
  events: LiveEvent[];
};

export async function writeLive(data: LiveWrite) {
  await ensureSchema();
  const sql = await getSql();
  const now = Date.now();
  await sql.query(
    `insert into activity_presence (
       session_id, at, role, who, path, device, browser, os, viewport, lang, mode, started_at, page_at, scenario, email
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     on conflict (session_id) do update set
       at = excluded.at,
       role = excluded.role,
       who = excluded.who,
       path = excluded.path,
       device = excluded.device,
       browser = excluded.browser,
       os = excluded.os,
       viewport = excluded.viewport,
       lang = excluded.lang,
       mode = excluded.mode,
       started_at = excluded.started_at,
       page_at = excluded.page_at,
       scenario = excluded.scenario,
       email = excluded.email`,
    [
      data.sessionId,
      now,
      data.role,
      data.who,
      data.path,
      data.device,
      data.browser,
      data.os,
      data.viewport,
      data.lang,
      data.mode,
      data.startedAt,
      data.pageAt,
      data.scenario,
      data.email,
    ],
  );
  for (const event of data.events) {
    await sql.query(
      `insert into activity_log (at, session_id, role, who, path, kind, label, device)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [now, data.sessionId, data.role, data.who, data.path, event.kind, event.label, data.device],
    );
  }
  await sql.query("delete from activity_presence where at < $1", [now - 24 * 60 * 60 * 1000]);
  await sql.query(`delete from activity_log where id in (select id from activity_log order by id desc offset 600)`);
  return { ok: true as const };
}

type PresenceSql = {
  session_id: string;
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
  started_at: number;
  page_at: number;
  scenario: string;
  email: string;
};

function mapPresence(row: PresenceSql) {
  return {
    sessionId: row.session_id,
    at: Number(row.at),
    role: row.role,
    who: row.who,
    path: row.path,
    device: row.device,
    browser: row.browser || "",
    os: row.os || "",
    viewport: row.viewport || "",
    lang: row.lang || "",
    mode: row.mode || "",
    startedAt: Number(row.started_at) || 0,
    pageAt: Number(row.page_at) || 0,
    scenario: row.scenario || "",
    email: row.email || "",
  };
}

const PRESENCE_COLS = `session_id, at, role, who, path, device, browser, os, viewport, lang, mode, started_at, page_at, scenario, email`;

export async function readLive() {
  await ensureSchema();
  const sql = await getSql();
  const now = Date.now();
  const onlineCutoff = now - 15_000;
  const recentCutoff = now - 30 * 60 * 1000;
  const hourCutoff = now - 60 * 60 * 1000;
  const online = await sql.query<PresenceSql>(
    `select ${PRESENCE_COLS} from activity_presence where at > $1 order by at desc`,
    [onlineCutoff],
  );
  const recent = await sql.query<PresenceSql>(
    `select ${PRESENCE_COLS} from activity_presence where at <= $1 and at > $2 order by at desc limit 12`,
    [onlineCutoff, recentCutoff],
  );
  const events = await sql.query<{
    id: number;
    at: number;
    session_id: string;
    role: string;
    who: string;
    path: string;
    kind: string;
    label: string;
    device: string;
  }>(
    `select id, at, session_id, role, who, path, kind, label, device
     from activity_log
     order by id desc
     limit 180`,
  );
  const kinds = await sql.query<{ kind: string; n: number }>(
    `select kind, count(*)::int as n from activity_log where at > $1 group by kind`,
    [hourCutoff],
  );
  const sessions = await sql.query<{ n: number }>(
    `select count(distinct session_id)::int as n from activity_log where at > $1`,
    [hourCutoff],
  );
  const hour = { actions: 0, opens: 0, taps: 0, sessions: Number(sessions[0]?.n ?? 0) };
  for (const row of kinds) {
    const n = Number(row.n) || 0;
    if (row.kind === "action") hour.actions = n;
    else if (row.kind === "open") hour.opens = n;
    else if (row.kind === "tap") hour.taps = n;
  }
  return {
    ok: true as const,
    now,
    online: online.map(mapPresence),
    recent: recent.map(mapPresence),
    hour,
    events: events.map((row) => ({
      id: Number(row.id),
      at: Number(row.at),
      sessionId: row.session_id,
      role: row.role,
      who: row.who,
      path: row.path,
      device: row.device || "",
      kind: row.kind,
      label: row.label,
    })),
  };
}
