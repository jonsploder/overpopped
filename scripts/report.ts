// Build report/index.html: how online play has felt (lag) and which levels are too easy or
// too hard. Uses whatever `npm run fetch-traces` has downloaded.
//
//   npm run report               (fetch first with: npm run fetch-traces)
//   npm run report -- --sweep    (also compare alternative netcode settings; slower)
import { SETS, TOWER, V21_TOWER, V22_TOWER } from '../src/levels';
import type { NetStats } from '../src/rollback';
import { addStats, emptyTotals, loadSessions, runAll, setQuiet, sweep } from './tracelib';
import type { ReplayResult, Totals } from './tracelib';

declare function require(name: string): any;
declare const process: { argv: string[]; exit(code: number): never };
const fs = require('fs'), path = require('path');

const doSweep = process.argv.includes('--sweep');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (a: number, b: number, d = 1) => (b ? ((100 * a) / b).toFixed(d) : '0.0') + '%';
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const mins = (secs: number) => (secs / 60).toFixed(1);

// ------------------------------------------------------------------ lag
setQuiet(true);
const sessions = loadSessions('traces').filter((x) => !x.name.startsWith('synthetic'));
const { T: replayed, results } = runAll(sessions);

interface Group { label: string; rows: ReplayResult[] }
function groupBy(rows: ReplayResult[], key: (r: ReplayResult) => string): Group[] {
  const m = new Map<string, ReplayResult[]>();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
  return [...m].map(([label, rows]) => ({ label, rows })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}
const liveTotals = (rows: ReplayResult[]): Totals => {
  const T = emptyTotals();
  for (const r of rows) { T.n++; for (const s of r.live) if (s) addStats(T, s as NetStats); }
  return T;
};
const lagCells = (T: Totals) =>
  `<td>${pct(T.stalled, T.ticks, 2)}</td><td>${pct(T.slowed, T.ticks, 2)}</td><td>${pct(T.errFrames, T.confirmed, 2)}</td>` +
  `<td>${(T.rollbackFrames / Math.max(1, T.rollbacks)).toFixed(1)}f</td><td>${T.maxRollback}f</td>`;
const linkCells = (rows: ReplayResult[]) => {
  const l = rows.flatMap((r) => r.links);
  return `<td>${median(l.map((x) => x.median)).toFixed(0)} ms</td><td>${median(l.map((x) => x.p95)).toFixed(0)} ms</td><td>${(l.reduce((a, x) => a + x.loss, 0) / Math.max(1, l.length)).toFixed(2)}%</td>`;
};
const lagHead = '<th>Link (median)</th><th>Link (p95)</th><th>Loss</th><th>Frozen</th><th>Slowed</th><th>Other players visibly off</th><th>Avg rollback</th><th>Max rollback</th>';

const byVersion = groupBy(results, (r) => `v${r.meta.version}, ${r.players} players`);
const lagRows = byVersion.map((g) => {
  const secs = g.rows.reduce((a, r) => a + r.secs, 0);
  const desyncs = g.rows.filter((r) => r.live.some((s) => s && (s as NetStats & { desync?: boolean }).desync)).length;
  return `<tr><td>${esc(g.label)}</td><td>${g.rows.length}</td><td>${mins(secs)}</td>${linkCells(g.rows)}${lagCells(liveTotals(g.rows))}<td>${desyncs}</td></tr>`;
}).join('');
const allSecs = results.reduce((a, r) => a + r.secs, 0);
const replayRow = `<tr class="total"><td>All sessions, replayed with today's netcode</td><td>${results.length}</td><td>${mins(allSecs)}</td>${linkCells(results)}${lagCells(replayed)}<td>${replayed.ok ? 0 : 'yes'}</td></tr>`;

const recent = [...results].sort((a, b) => b.meta.date.localeCompare(a.meta.date)).slice(0, 40).map((r) => {
  const live = liveTotals([r]), now = emptyTotals();
  for (const s of r.stats) addStats(now, s);
  const set = SETS[r.meta.set];
  return `<tr><td>${esc(r.meta.date.slice(0, 16).replace('T', ' '))}</td><td>${r.players}</td><td>${esc(r.meta.mode ?? 'classic')}</td><td>${esc(set?.name ?? '?')} ${r.meta.level + 1}</td><td>${r.secs.toFixed(0)} s</td>` +
    `<td>${median(r.links.map((l) => l.median)).toFixed(0)} ms</td><td>${pct(live.errFrames, live.confirmed)}</td><td>${pct(now.errFrames, now.confirmed)}</td><td>${pct(live.slowed, live.ticks)}</td></tr>`;
}).join('');

let sweepHtml = '';
if (doSweep && sessions.length) {
  const rows = sweep(sessions).map(({ label, T }) =>
    `<tr${label === 'current settings' ? ' class="total"' : ''}><td>${esc(label)}</td><td>${(T.bad / Math.max(1, T.n)).toFixed(3)}</td>${lagCells(T)}</tr>`).join('');
  sweepHtml = `<h3>Alternative netcode settings, replayed over every session</h3>
<p class="note">One setting changed at a time. Lower badness is better. Replays tend to under-report visible corrections compared with live play, so compare rows with each other rather than with the live numbers.</p>
<div class="scroll"><table><tr><th>Setting</th><th>Badness</th><th>Frozen</th><th>Slowed</th><th>Other players visibly off</th><th>Avg rollback</th><th>Max rollback</th></tr>${rows}</table></div>`;
}

// ------------------------------------------------------------------ levels
interface LevelRec { set: string; players: number; mode: string; online: boolean; version: number; hist: number[][];
  /** Anonymous browser id and seconds played in the game (from late v23 on). */
  pid?: string; secs?: number;
  /** Online, a copy from a player other than player 1: counts players, not levels. */
  guest?: boolean;
  /** Day uploaded (from the file name). */
  day: string }
const allRecs: LevelRec[] = [];
const lvDir = path.join('stats', 'levels');
if (fs.existsSync(lvDir)) {
  for (const f of fs.readdirSync(lvDir)) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(lvDir, f), 'utf8'));
      if (r.format === 'splitstorm-levels') allRecs.push({ ...r, day: /^\d{4}-\d{2}-\d{2}/.exec(f)?.[0] ?? '?' });
    } catch { /* skip */ }
  }
}
const recs = allRecs.filter((r) => !r.guest);

// ------------------------------------------------------------------ players
// One id per browser: two people on one keyboard count as one player, and clearing site data makes a new one.
interface PlayerAgg { secs: number; games: number; days: Set<string>; first: string }
const players = new Map<string, PlayerAgg>();
for (const r of allRecs) {
  if (!r.pid) continue;
  let p = players.get(r.pid);
  if (!p) { p = { secs: 0, games: 0, days: new Set(), first: r.day }; players.set(r.pid, p); }
  p.secs += r.secs ?? 0;
  p.games++;
  p.days.add(r.day);
  if (r.day < p.first) p.first = r.day;
}
const ps = [...players.values()], untracked = allRecs.filter((r) => !r.pid).length;
const totalSecs = ps.reduce((a, p) => a + p.secs, 0);
const hm = (secs: number) => (secs >= 3600 ? `${(secs / 3600).toFixed(1)} h` : `${(secs / 60).toFixed(secs < 600 ? 1 : 0)} min`);
const BUCKETS: [string, number][] = [['under 1 min', 60], ['1-5 min', 300], ['5-15 min', 900], ['15-60 min', 3600], ['1-3 h', 3 * 3600], ['3 h or more', Infinity]];
const bucketRows = BUCKETS.map(([label, top], i) => {
  const lo = i ? BUCKETS[i - 1][1] : -1, n = ps.filter((p) => p.secs > lo && p.secs <= top).length;
  return `<tr><td>${label}</td><td><span class="bar"><i style="width:${ps.length ? ((100 * n) / ps.length).toFixed(0) : 0}%"></i></span>${n}</td><td>${pct(n, ps.length, 0)}</td></tr>`;
}).join('');
const dayMap = new Map<string, { pids: Set<string>; fresh: number; secs: number }>();
for (const r of allRecs) {
  if (!r.pid) continue;
  const d = dayMap.get(r.day) ?? { pids: new Set(), fresh: 0, secs: 0 };
  if (!d.pids.has(r.pid) && players.get(r.pid)!.first === r.day) d.fresh++;
  d.pids.add(r.pid);
  d.secs += r.secs ?? 0;
  dayMap.set(r.day, d);
}
const dayRows = [...dayMap].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30)
  .map(([day, d]) => `<tr><td>${day}</td><td>${d.pids.size}</td><td>${d.fresh}</td><td>${hm(d.secs)}</td><td>${hm(d.secs / d.pids.size)}</td></tr>`).join('');
const playersHtml = `<h2>Players</h2>
<p class="note">Players are counted by an anonymous id kept in each browser, so two people sharing a keyboard count as one, and the same person on another device or after clearing site data counts again. Time is time spent playing (not paused, not on menus). Every online player is counted, not only player 1.${untracked ? ` ${untracked} older game records from before the id was added are left out.` : ''}</p>
<div class="cards">
  <div class="card"><b>${ps.length}</b><span>unique players</span></div>
  <div class="card"><b>${hm(totalSecs)}</b><span>played in total</span></div>
  <div class="card"><b>${ps.length ? hm(median(ps.map((p) => p.secs))) : '-'}</b><span>median time per player</span></div>
  <div class="card"><b>${ps.length ? hm(totalSecs / ps.length) : '-'}</b><span>average time per player</span></div>
  <div class="card"><b>${ps.length ? median(ps.map((p) => p.games)) : '-'}</b><span>median games per player</span></div>
  <div class="card"><b>${pct(ps.filter((p) => p.days.size > 1).length, ps.length, 0)}</b><span>came back on another day</span></div>
</div>
<h3>Time played per player</h3>
<div class="scroll"><table><tr><th>Total time</th><th>Players</th><th>Share</th></tr>${bucketRows}</table></div>
<h3>By day (UTC, last 30)</h3>
<div class="scroll"><table><tr><th>Day</th><th>Players</th><th>New players</th><th>Time played</th><th>Per player</th></tr>${dayRows || '<tr><td colspan="5" class="muted">No player data yet</td></tr>'}</table></div>
`;

interface LevelAgg { games: number; attempts: number; clears: number; firstTries: number; firstClears: number; clearTimes: number[]; lost: number; quits: number; solo: [number, number]; group: [number, number] }
const agg = new Map<string, LevelAgg>();
for (const r of recs) {
  const seen = new Set<number>();
  for (const [lv, ticks, result, lost] of r.hist) {
    // v18 put Photo Finish in at tower level 8: older tower records count from the old layout
    let level = r.set === 'tower' && r.version < 18 && lv >= 7 ? lv + 1 : lv;
    // v21 put Every Shot Counts in at tower level 35 (index 34)
    if (r.set === 'tower' && r.version < 21 && level >= 34) level++;
    // v22 moved Photo Finish, Quickstep and Last Stand
    if (r.set === 'tower' && r.version < 23) level = TOWER.findIndex((L) => L.name === (r.version < 22 ? V21_TOWER : V22_TOWER)[level]);
    const k = `${r.set}:${level}`;
    let a = agg.get(k);
    if (!a) { a = { games: 0, attempts: 0, clears: 0, firstTries: 0, firstClears: 0, clearTimes: [], lost: 0, quits: 0, solo: [0, 0], group: [0, 0] }; agg.set(k, a); }
    if (result === 2) { a.quits++; continue; } // gave up mid-attempt: not counted as an attempt
    const first = !seen.has(level);
    if (first) { seen.add(level); a.games++; a.firstTries++; if (result === 1) a.firstClears++; }
    a.attempts++;
    a.lost += lost;
    const bucket = r.players === 1 ? a.solo : a.group;
    bucket[0]++;
    if (result === 1) { a.clears++; a.clearTimes.push(ticks / 60); bucket[1]++; }
  }
}

function verdict(a: LevelAgg | undefined): [string, string] {
  if (!a || a.attempts < 5) return ['little data', 'muted'];
  const rate = a.clears / a.attempts, first = a.firstClears / Math.max(1, a.firstTries);
  if (a.firstTries >= 5 && first >= 0.9) return ['too easy?', 'easy'];
  if (rate < 0.2) return ['too hard?', 'hard'];
  if (rate < 0.4) return ['hard', 'warn'];
  return ['ok', 'ok'];
}

const levelTables = SETS.map((set) => {
  const rows = set.levels.map((L, i) => {
    const a = agg.get(`${set.id}:${i}`);
    const [v, cls] = verdict(a);
    if (!a) return `<tr><td>${i + 1}</td><td>${esc(L.name)}</td><td colspan="10" class="muted">not played yet</td><td><span class="tag muted">no data</span></td></tr>`;
    const rate = a.clears / Math.max(1, a.attempts);
    const ratio = (b: [number, number]) => (b[0] ? `${pct(b[1], b[0], 0)} <span class="muted">(${b[0]})</span>` : '<span class="muted">-</span>');
    return `<tr><td>${i + 1}</td><td>${esc(L.name)}</td><td>${a.games}</td><td>${a.attempts}</td><td><span class="bar"><i style="width:${(rate * 100).toFixed(0)}%"></i></span>${pct(a.clears, a.attempts, 0)}</td>` +
      `<td>${pct(a.firstClears, a.firstTries, 0)}</td><td>${a.clears ? (a.attempts / a.clears).toFixed(1) : '-'}</td><td>${a.clearTimes.length ? median(a.clearTimes).toFixed(0) + ' s' : '-'}</td>` +
      `<td>${a.clears ? (a.lost / a.clears).toFixed(1) : a.lost ? `${a.lost} lost, none cleared` : '-'}</td><td>${a.quits || ''}</td>` +
      `<td>${ratio(a.solo)}</td><td>${ratio(a.group)}</td><td><span class="tag ${cls}">${v}</span></td></tr>`;
  }).join('');
  return `<h3>${esc(set.name)}</h3><div class="scroll"><table><tr><th>#</th><th>Level</th><th>Games</th><th>Attempts</th><th>Cleared per attempt</th><th>Cleared first try</th><th>Attempts per clear</th><th>Median clear time</th><th>Lives lost per clear</th><th>Gave up mid-level</th><th>Solo</th><th>2+ players</th><th>Verdict</th></tr>${rows}</table></div>`;
}).join('');
const modeCounts = groupCount(recs.map((r) => `${r.mode}${r.players > 1 ? ` (${r.players}p)` : ' (solo)'}`));
function groupCount(xs: string[]) { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort().map(([k, n]) => `${esc(k)}: ${n}`).join(', '); }

// ------------------------------------------------------------------ page
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Overpopped report</title>
<style>
:root { --bg:#f7f7fb; --fg:#1b1d2e; --muted:#6b6f8a; --line:#dfe1ee; --card:#fff; --accent:#4c5bd4; --ok:#2f9e44; --warn:#e8590c; --bad:#c92a2a; --easy:#1c7ed6; }
@media (prefers-color-scheme: dark) { :root { --bg:#0d0f1c; --fg:#e7e9f8; --muted:#8a90b8; --line:#262a44; --card:#141729; --accent:#8c96ff; --ok:#69db7c; --warn:#ffa94d; --bad:#ff8787; --easy:#74c0fc; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
main { max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { margin: 0 0 4px; font-size: 26px; } h2 { margin: 40px 0 8px; font-size: 20px; } h3 { margin: 24px 0 8px; font-size: 16px; }
.sub, .note, .muted { color: var(--muted); } .note { max-width: 760px; }
.scroll { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
th, td { padding: 7px 10px; text-align: right; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { font-weight: 600; color: var(--muted); font-size: 12px; } tr:last-child td { border-bottom: 0; }
th:first-child, td:first-child, th:nth-child(2), td:nth-child(2), td[colspan] { text-align: left; }
tr.total td { font-weight: 600; background: color-mix(in srgb, var(--accent) 8%, transparent); }
.tag { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; border: 1px solid currentColor; }
.tag.ok { color: var(--ok); } .tag.warn { color: var(--warn); } .tag.hard { color: var(--bad); } .tag.easy { color: var(--easy); } .tag.muted { color: var(--muted); }
.bar { display: inline-block; width: 60px; height: 6px; margin-right: 8px; vertical-align: middle; border-radius: 3px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 16px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.regen { float: right; margin-top: -30px; } .regen button { font: inherit; font-weight: 600; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: var(--bg); cursor: pointer; } .regen button:disabled { opacity: .5; cursor: wait; }
.card b { display: block; font-size: 22px; } .card span { color: var(--muted); font-size: 12px; }
</style></head><body><main>
<h1>Overpopped report</h1>
<div class="regen"><button id="regen">Regenerate</button> <span id="regen-msg" class="muted"></span></div>
<script>
document.getElementById('regen').onclick = async (e) => {
  const btn = e.target, msg = document.getElementById('regen-msg');
  btn.disabled = true; msg.textContent = 'Downloading new logs and rebuilding...';
  try {
    const r = await fetch('/regen', { method: 'POST' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).log || r.status);
    location.reload();
  } catch (err) {
    btn.disabled = false;
    msg.textContent = location.protocol === 'file:'
      ? 'Opened as a file: run npm run report:serve and open http://localhost:5299 to use this button (or run npm run fetch-traces && npm run report).'
      : 'Failed: ' + String(err.message || err).slice(-300);
  }
};
</script>
<div class="sub">Generated ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC from ${results.length} recorded online sessions and ${recs.length} games of level stats.</div>
<div class="cards">
  <div class="card"><b>${results.length}</b><span>online sessions (${mins(allSecs)} min)</span></div>
  <div class="card"><b>${median(results.flatMap((r) => r.links.map((l) => l.median))).toFixed(0)} ms</b><span>typical one-way delay</span></div>
  <div class="card"><b>${pct(liveTotals(results).stalled, liveTotals(results).ticks, 2)}</b><span>time frozen (live)</span></div>
  <div class="card"><b>${pct(replayed.errFrames, replayed.confirmed, 2)}</b><span>other players visibly off (today's netcode, replayed)</span></div>
  <div class="card"><b>${recs.length}</b><span>games with level stats</span></div>
  <div class="card"><b>${ps.length}</b><span>unique players (${hm(totalSecs)} played)</span></div>
</div>
${playersHtml}
<h2>Online play</h2>
<p class="note">"Frozen", "Slowed" and "Visibly off" are what players actually experienced, recorded during each game. "Visibly off" is the share of frames where another player was drawn more than 8 px from where they really were (a prediction that then had to be corrected). The last row replays every session's real network conditions through today's netcode.</p>
<div class="scroll"><table><tr><th>Version, players</th><th>Sessions</th><th>Minutes</th>${lagHead}<th>Desyncs</th></tr>${lagRows}${replayRow}</table></div>
${sweepHtml}
<h3>Most recent sessions</h3>
<div class="scroll"><table><tr><th>Date (UTC)</th><th>Players</th><th>Mode</th><th>Level</th><th>Length</th><th>Link</th><th>Visibly off (live)</th><th>Visibly off (today, replayed)</th><th>Slowed (live)</th></tr>${recent || '<tr><td colspan="9" class="muted">No sessions yet</td></tr>'}</table></div>

<h2>Level difficulty</h2>
<p class="note">One attempt is one try at a level until it is cleared or everyone is down. "Cleared first try" only counts the first time a game reached that level. Levels marked <span class="tag easy">too easy?</span> were cleared first time in at least 90% of games; <span class="tag hard">too hard?</span> were cleared on fewer than 20% of attempts. Attempts abandoned by quitting are left out. Games counted: ${modeCounts || 'none yet'}.</p>
${levelTables}
</main></body></html>
`;
fs.mkdirSync('report', { recursive: true });
fs.writeFileSync(path.join('report', 'index.html'), html);
console.log(`Wrote report/index.html  (${results.length} sessions, ${recs.length} level-stat games)`);
