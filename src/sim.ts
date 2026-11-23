// Deterministic game simulation.
//
// Rules for this file (they are what make online play possible later):
//  - step() is a pure function of (state, inputs). No Math.random, no Date, no DOM.
//  - All state lives in the plain-JSON `State` object, so it can be snapshotted,
//    restored (rollback) and hashed (desync detection).
//  - Runs at a fixed 60 ticks per second.

export const W = 960;
export const H = 480; // floor y
export const DT = 1 / 60;

const G = 900;
const VX = 105;
export const RADII = [8, 13, 20, 29, 40, 52];
// Height the bottom of the ball reaches above the surface it bounced on.
// Size 0 clears the player's head (44px) by a little: you can stand under it, just.
const BOUNCE_H = [62, 108, 150, 190, 226, 258];
const BOUNCE_V = BOUNCE_H.map((h) => Math.sqrt(2 * G * h));
const FAST = 1.6;

export const PW = 26;
export const PH = 44;
/** How long the end-of-floor ceremony lasts (ticks). */
export const FLOOR_UP_TICKS = 330;
const PSPEED = 250;
const WIRE_SPEED = 620;
const BULLET_SPEED = 900;
const ANCHOR_TICKS = 200;
const SPIKE = 8;

export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_FIRE = 4;
/** Sent for a single tick: toggles pause for everyone. */
export const IN_PAUSE = 8;

/**
 * stub: a harpoon that only reaches a little above your head. sword: a swipe in front of you.
 * side: a bolt along the floor, picking up speed. rocket: the same, straight up.
 * lance: a long thin bar of light that travels up.
 */
export type Weapon = 'harpoon' | 'twin' | 'anchor' | 'pulse' | 'beam' | 'stub' | 'sword' | 'side' | 'rocket' | 'lance';
/** 'haste' is a curse: it makes you run much faster than you can control for a while. */
/** 'master' (roped modes only): the holder can drag their neighbours along by the rope. */
export type PickupKind = Weapon | 'shield' | 'slow' | 'time' | 'life' | 'haste' | 'master';
/** Every drop, in the order the drops page shows them. A player's `st.got` has bit i set once they've picked up PICKUP_KINDS[i]. */
export const PICKUP_KINDS: PickupKind[] = ['harpoon', 'twin', 'anchor', 'stub', 'pulse', 'beam', 'sword', 'side', 'rocket', 'lance', 'shield', 'slow', 'time', 'life', 'haste', 'master'];

export interface BallDef { x: number; y: number; size: number; dir: 1 | -1; fast?: boolean; group?: number; /** Pieces it pops into (default: the level's `split`, else 2). */ split?: number; /** Bounces straight up and down. */ still?: boolean; /** Hits needed before it will pop; each hit punts it upward instead. */ armor?: number }
export interface RectDef {
  x: number; y: number; w: number; h: number; gate?: number;
  /** Slides back and forth by (dx, dy) over `period` seconds. Keep moving blocks above head height. */
  move?: { dx: number; dy: number; period: number };
}
export interface Block extends RectDef { bx: number; by: number }

export interface Level {
  name: string;
  /** Tower floor (1-based). Reaching a new floor refills everyone's lives. */
  floor?: number;
  hint?: string;
  /** The hint on a touch screen, where it differs. */
  touchHint?: string;
  time: number; // seconds
  balls: BallDef[];
  rects?: RectDef[];
  /** Roof descends at `speed` px/s; each pop shoves it back up by `lift` px. */
  ceiling?: { speed: number; lift: number };
  /** Spiked roof destroys balls outright instead of bouncing them. Default: on for fixed roofs. */
  spikes?: boolean;
  /** Weapon everyone starts the level with. */
  weapon?: Weapon;
  /** No misses: a harpoon, vine or rocket that reaches the roof (or a block) without hitting a ball costs its owner a life. */
  noMiss?: boolean;
  drops?: PickupKind[];
  dropRate?: number;
  /** Ball speed multiplier gained per second. */
  ramp?: number;
  /** Gravity for balls flips every `flip` seconds. */
  flip?: number;
  /** Sideways push on every ball, px/s (positive = rightwards). */
  wind?: number;
  /** The view turns upside down (and back) every `spin` seconds. Purely visual. */
  spin?: number;
  /** The view is upside down for the whole level. Purely visual. */
  upsideDown?: boolean;
  /** Pairs of linked portals [ax, ay, bx, by]: a ball entering either comes out of the other. */
  portals?: number[][];
  /** A one-way loop of numbered portals [[x, y], ...]: 1 leads to 2, 2 to 3, ..., the last back to 1. */
  chain?: number[][];
  /** Pieces each ball pops into (2 normally; 3 or 4 make for crowded levels). */
  split?: number;
  /** Player running speed multiplier for the whole level. */
  playerSpeed?: number;
  /** Player start x positions. */
  start?: number[];
}

export interface Ball { x: number; y: number; vx: number; vy: number; size: number; fast: boolean; group: number; immune: number; armor: number; split: number;
  /** Ticks before it can use a portal again. */
  pcd: number }
export interface Shot { kind: 'wire' | 'bullet' | 'beam' | 'slash' | 'dartx' | 'darty' | 'lance'; x: number; y: number; owner: number; sticky: boolean; t: number;
  /** Darts: current speed (signed). Slash: the way it faces. */
  v: number;
  /** Wire: highest point it may reach (0 = the roof). */
  lim: number }
export interface Pickup { x: number; y: number; kind: PickupKind; t: number }
/** Game modes. Single-player games are always classic. */
export type Mode = 'classic' | 'onegun' | 'vip' | 'versus' | 'tethered' | 'revive' | 'duo';
export const MODES: { id: Mode; name: string; hint: string }[] = [
  { id: 'classic', name: 'Classic', hint: 'Everyone shoots. Each player has their own 3 lives.' },
  { id: 'onegun', name: 'One Gun', hint: 'Roped together. Only one player can shoot. When they fall, the gun passes to someone at random.' },
  { id: 'vip', name: 'Protect the VIP', hint: 'Roped together. The VIP (crown) cannot shoot. If the VIP is hit, everyone loses a life.' },
  { id: 'versus', name: 'Versus', hint: 'Each player gets a lane. Balls you pop split into your rivals\' lanes. Clear yours first; first to 3 rounds wins.' },
  { id: 'tethered', name: 'Tethered', hint: 'Players are roped together and can only get so far apart.' },
  { id: 'duo', name: 'Two Heads', hint: 'Two players, one body: one moves, one shoots. You swap every level.' },
  { id: 'revive', name: 'Revive', hint: 'Shared lives. Revive a fallen teammate by standing in their circle before their time runs out. All must be up to finish.' },
];
/** Revive mode: how long a fallen player waits, the size of their circle, and how long reviving takes. */
export const REVIVE_TICKS = 15 * 60;
/** How fast the revive ring fills: full speed on the first fall of a level, then half as fast with each fall after it. */
export const REVIVE_RATES = [1, 0.5, 0.25, 0.125];
export const REVIVE_R = 34;
export const REVIVE_NEED = 90;
/** Roped modes: longest the rope between neighbouring players can stretch. */
export const TETHER = 170;
/** Modes in which neighbouring players are roped together. */
export const roped = (m: Mode) => m === 'tethered' || m === 'onegun' || m === 'vip';
/** Reach of the short harpoon above the head, the sword in front, and the lance's length. */
export const STUB_REACH = 72;
/** Ticks between short harpoon shots (0.6 s); it also rises at half a harpoon's speed. */
export const STUB_CD = 36;
export const SWORD_REACH = 46;
export const LANCE_LEN = 96;
/** Length of the floor bolt's tail, which grows with its speed. */
export const boltTail = (v: number) => Math.min(180, Math.abs(v) * 0.15);
const DART_V0 = 150, DART_ACC = 1400, LANCE_SPEED = 800;
/** The rocket's body: half its width, and its length (px). */
export const ROCKET_HALF = 9, ROCKET_LEN = 26;
/** Versus: round wins needed to win the game. */
export const VERSUS_WINS = 3;

/** Running totals for the end-of-game stats screen. */
export interface PlayerStats { pops: number; score: number; alive: number; deaths: number; shots: number; picks: number;
  /** Ticks spent with a ball within 16 px ("most reckless"). */
  danger: number;
  /** Smallest gap, in px, between a ball and this player that didn't hit them ("closest shave"). */
  shave: number;
  revives: number;
  /** Drops picked up this game, one bit per PICKUP_KINDS entry. */
  got: number }

export interface Player { x: number; face: number; weapon: Weapon; cd: number; shield: boolean; invuln: number;
  /** Allowed to shoot (always true in classic). */
  armed: boolean;
  /** Protect the VIP: this is the VIP. */
  vip: boolean;
  st: PlayerStats;
  /** Each player has their own lives. */
  lives: number;
  /** Hit on this attempt: sits out until the level restarts or is cleared. */
  down: boolean;
  /** Haste curse: ticks left. */
  haste: number;
  /** Revive mode, while down: ticks left to be revived, revive progress, and how fast that progress fills (REVIVE_RATES). */
  rt: number;
  rp: number;
  rr: number;
  /** Versus: rounds won. */
  wins: number;
  /** Roped modes: holds the rope and can drag neighbours along. */
  master: boolean;
  /** Two Heads: the player whose body this one rides in as the gunner (-1 = has a body of their own). */
  ride: number;
}

export type Phase = 'ready' | 'play' | 'dead' | 'clear' | 'over' | 'won';

export interface State {
  tick: number;
  paused: boolean;
  rng: number;
  level: number;
  phase: Phase;
  phaseT: number;
  score: number;
  timeLeft: number; // ticks
  ceilY: number;
  speed: number;
  slowT: number;
  /** Ticks of play on the current level. */
  lt: number;
  /** 1 = normal gravity, -1 = flipped. */
  grav: number;
  balls: Ball[];
  rects: Block[];
  shots: Shot[];
  pickups: Pickup[];
  players: Player[];
  mode: Mode;
  /** One entry per finished attempt: [level, ticks played, cleared 1 / failed 0, lives lost]. */
  hist: number[][];
  /** Lives lost so far on the current attempt. */
  lost: number;
  /** Revive mode: the team's shared lives. */
  team: number;
  /** Revive mode: falls so far on this attempt at the level (sets how slowly the next revive fills). */
  falls: number;
}

export type GameEvent =
  | { t: 'pop'; x: number; y: number; size: number }
  | { t: 'spike'; x: number; y: number; size: number }
  | { t: 'knock'; x: number; y: number }
  | { t: 'flip' }
  | { t: 'shoot'; weapon: Weapon; p: number }
  | { t: 'pickup'; kind: PickupKind }
  | { t: 'shield' }
  | { t: 'die'; x: number }
  | { t: 'gate' }
  | { t: 'clear' }
  | { t: 'floor' }
  | { t: 'handoff'; x: number }
  | { t: 'send'; x: number }
  | { t: 'portal'; x: number; y: number }
  | { t: 'revive'; x: number }
  | { t: 'haste' }
  | { t: 'start' };

/** Fixed roofs are spiked unless the level says otherwise; descending roofs are smooth by default. */
export function hasSpikes(L: Level): boolean {
  return L.spikes ?? !(L.ceiling || L.flip);
}

/** Versus rounds are generated: one lane per player, the same balls in each lane. */
const ARENA_ROUNDS: { size: number; dx: number; fast?: boolean }[][] = [
  [{ size: 3, dx: 0 }],
  [{ size: 3, dx: -0.2 }, { size: 1, dx: 0.25, fast: true }],
  [{ size: 4, dx: 0 }],
  [{ size: 3, dx: -0.25 }, { size: 2, dx: 0.25, fast: true }],
  [{ size: 4, dx: -0.15 }, { size: 2, dx: 0.3, fast: true }],
];
const arenaCache = new Map<number, Level>();
function versusArena(round: number, n: number): Level {
  const key = round * 10 + n;
  let L = arenaCache.get(key);
  if (L) return L;
  const lane = W / n, layout = ARENA_ROUNDS[Math.min(round, ARENA_ROUNDS.length - 1)];
  const balls: BallDef[] = [], rects: RectDef[] = [], start: number[] = [];
  for (let k = 0; k < n; k++) {
    const c = lane * (k + 0.5);
    start.push(c);
    if (k > 0) rects.push({ x: lane * k - 5, y: 0, w: 10, h: H });
    layout.forEach((b, j) => balls.push({ x: c + b.dx * lane, y: 170 + j * 40, size: b.size, dir: j % 2 ? -1 : 1, fast: b.fast }));
  }
  L = {
    name: `Round ${round + 1}`, hint: `Your pops split into your rivals' lanes. Clear yours first. First to ${VERSUS_WINS} wins.`,
    time: 60 + 15 * Math.min(round, 4), balls, rects, start, ramp: round >= 3 ? 0.006 : 0,
  };
  arenaCache.set(key, L);
  return L;
}

/** The level being played: a level from the set, or a generated arena in Versus. */
export function levelAt(s: State, levels: Level[]): Level {
  return s.mode === 'versus' ? versusArena(s.level, s.players.length) : levels[s.level];
}

const DEFAULT_DROPS: PickupKind[] = ['twin', 'anchor', 'harpoon', 'shield', 'slow', 'time', 'rocket', 'lance'];

function rand(s: State): number {
  // mulberry32
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function newGame(levels: Level[], numPlayers: number, startLevel = 0, seed = 1234567, mode: Mode = 'classic'): State {
  const s: State = {
    tick: 0, paused: false, rng: seed | 0, level: startLevel, phase: 'ready', phaseT: 0, score: 0,
    timeLeft: 0, ceilY: 0, speed: 1, slowT: 0, lt: 0, grav: 1, balls: [], rects: [], shots: [], pickups: [],
    players: [], mode: numPlayers > 1 ? mode : 'classic', hist: [], lost: 0, team: 3, falls: 0,
  };
  for (let i = 0; i < numPlayers; i++) s.players.push({ x: W / 2, face: 1, weapon: 'harpoon', cd: 0, shield: false, invuln: 0, lives: 3, down: false,
    armed: true, vip: false, haste: 0, rt: 0, rp: 0, rr: 1, wins: 0, master: false, ride: -1,
    st: { pops: 0, score: 0, alive: 0, deaths: 0, shots: 0, picks: 0, danger: 0, shave: 999, revives: 0, got: 0 } });
  if (s.mode === 'versus') s.level = 0;
  loadLevel(s, levels);
  return s;
}

function loadLevel(s: State, levels: Level[]) {
  const L = levelAt(s, levels);
  s.balls = L.balls.map((b) => ({ x: b.x, y: b.y, vx: b.still ? 0 : b.dir * VX, vy: 0, size: b.size, fast: !!b.fast, group: b.group ?? 0, immune: 0, armor: b.armor ?? 0, split: b.split ?? L.split ?? 2, pcd: 0 }));
  s.rects = (L.rects ?? []).map((r) => ({ ...r, bx: r.x, by: r.y }));
  s.lt = 0;
  s.falls = 0;
  s.grav = 1;
  s.shots = [];
  s.pickups = [];
  s.ceilY = 0;
  s.speed = 1;
  s.slowT = 0;
  s.timeLeft = L.time * 60;
  s.phase = 'ready';
  s.phaseT = 100;
  const n = s.players.length;
  s.players.forEach((p, i) => {
    // Levels list start spots for two players; a third and fourth stand just beside them.
    const st = L.start;
    p.x = !st ? W / 2 + (i - (n - 1) / 2) * 70 : i < st.length ? st[i] : Math.min(W - PW / 2, st[i % st.length] + 34);
    // roped together: start side by side
    if (roped(s.mode)) p.x = Math.max(PW / 2, Math.min(W - PW / 2, (st?.[0] ?? W / 2) + (i - (n - 1) / 2) * 50));
    p.down = s.mode === 'revive' ? false : p.lives <= 0;
    p.haste = 0;
    p.rt = 0;
    p.rp = 0;
    p.face = 1;
    p.weapon = L.weapon ?? 'harpoon';
    p.cd = 0;
    p.shield = false;
    p.invuln = 0;
    p.master = false;
    p.ride = -1;
  });
  if (s.mode === 'duo') {
    // pairs share a body; who moves and who shoots swaps every level. An odd player out plays alone.
    const bodies = Math.ceil(n / 2);
    for (let k = 0; k < bodies; k++) {
      const st = L.start;
      const x = st ? (k < st.length ? st[k] : st[k % st.length] + 34) : W / 2 + (k - (bodies - 1) / 2) * 70;
      const a = 2 * k, b = a + 1;
      s.players[a].x = x;
      if (b >= n) continue;
      s.players[b].x = x;
      s.players[s.level % 2 ? a : b].ride = s.level % 2 ? b : a;
    }
  }
  s.lost = 0;
  assignRoles(s);
}

/** Pick who holds the gun (One Gun) or who is the VIP, at random among those still playing. */
function assignRoles(s: State) {
  const standing = s.players.filter((p) => !p.down);
  for (const p of s.players) { p.armed = true; p.vip = false; }
  if ((s.mode !== 'onegun' && s.mode !== 'vip') || standing.length === 0) return;
  const pick = standing[Math.floor(rand(s) * standing.length)];
  if (s.mode === 'onegun') {
    for (const p of s.players) p.armed = false;
    pick.armed = true;
  } else if (standing.length >= 2) {
    pick.vip = true;
    pick.armed = false;
  }
}

/** Lowest y a shot fired straight up at x can reach (roof or underside of a block). */
export function stopY(s: State, x: number, spikes: boolean): number {
  let y = s.ceilY + (spikes ? SPIKE : 0);
  for (const r of s.rects) if (x >= r.x && x <= r.x + r.w && r.y + r.h > y) y = r.y + r.h;
  return y;
}

function segHit(b: Ball, x: number, y0: number, y1: number, pad: number): boolean {
  const cy = b.y < y0 ? y0 : b.y > y1 ? y1 : b.y;
  const dx = b.x - x, dy = b.y - cy, r = RADII[b.size] + pad;
  return dx * dx + dy * dy < r * r;
}

function pop(s: State, i: number, L: Level, ev: GameEvent[], by?: Player) {
  const b = s.balls[i];
  s.balls.splice(i, 1);
  s.score += (b.size + 1) * 10;
  if (by) { by.st.pops++; by.st.score += (b.size + 1) * 10; }
  ev.push({ t: 'pop', x: b.x, y: b.y, size: b.size });
  if (L.ceiling) s.ceilY = Math.max(0, s.ceilY - L.ceiling.lift);
  if (b.size > 0 && b.split !== 1) { // split: 1 = pops clean, no children
    // Halves kick upward out of the pop. Hit a big ball at the top of its arc and the
    // halves fly high enough to burst on a spiked roof.
    const cs = b.size - 1, off = RADII[cs] * 0.6, kick = -(330 + 40 * cs);
    const k = Math.max(2, Math.min(4, b.split));
    // Versus: every piece after the first is sent to a random rival who is still standing
    const owner = by ? s.players.indexOf(by) : -1;
    const rivals = s.mode === 'versus' && owner >= 0 ? s.players.map((_, j) => j).filter((j) => j !== owner && !s.players[j].down) : [];
    for (let j = 0; j < k; j++) {
      const d = -1 + (2 * j) / (k - 1); // spread from -1 to 1
      const piece: Ball = { x: b.x + d * off, y: b.y, vx: d * VX, vy: s.grav > 0 ? Math.min(b.vy, kick) : Math.max(b.vy, -kick), size: cs, fast: b.fast, group: b.group, immune: 8, armor: 0, split: b.split, pcd: 0 };
      if (j > 0 && rivals.length) {
        const to = rivals[Math.floor(rand(s) * rivals.length)], lane = W / s.players.length;
        piece.x = lane * (to + 0.5) + (rand(s) - 0.5) * lane * 0.4;
        piece.y = 60 + RADII[cs];
        piece.vy = 0;
        piece.vx = (rand(s) < 0.5 ? -1 : 1) * VX;
        piece.immune = 30;
        ev.push({ t: 'send', x: piece.x });
      }
      s.balls.push(piece);
    }
  }
  if (rand(s) < (L.dropRate ?? 0.14)) {
    let pool = L.drops ?? DEFAULT_DROPS;
    if (pool.length && roped(s.mode)) pool = [...pool, 'master'];
    if (pool.length) s.pickups.push({ x: b.x, y: b.y, kind: pool[Math.floor(rand(s) * pool.length)], t: 420 });
  }
}

/** Would a player standing at x be inside a block? */
function blocked(s: State, x: number): boolean {
  for (const r of s.rects) if (r.y + r.h > H - PH && r.y < H && x + PW / 2 > r.x && x - PW / 2 < r.x + r.w) return true;
  return false;
}

function stepPlayers(s: State, inputs: number[], L: Level, ev: GameEvent[], canFire: boolean) {
  s.players.forEach((p, i) => {
    if (p.down || p.ride >= 0) return;
    const inp = inputs[i] | 0;
    const dx = (inp & IN_RIGHT ? 1 : 0) - (inp & IN_LEFT ? 1 : 0);
    if (dx) {
      const ox = p.x;
      p.face = dx;
      p.x += dx * PSPEED * (L.playerSpeed ?? 1) * (p.haste > 0 ? 1.8 : 1) * DT;
      if (roped(s.mode)) {
        // can't run further from a roped neighbour than the rope allows, unless you hold the rope: then they come too
        for (const j of [i - 1, i + 1]) {
          const q = s.players[j];
          if (!q || q.down) continue;
          if (p.master && Math.abs(p.x - q.x) > TETHER) {
            const nx = Math.max(PW / 2, Math.min(W - PW / 2, p.x + (q.x > p.x ? TETHER : -TETHER)));
            if (!blocked(s, nx)) q.x = nx;
          }
          if (p.x > q.x + TETHER) p.x = Math.max(ox, q.x + TETHER);
          if (p.x < q.x - TETHER) p.x = Math.min(ox, q.x - TETHER);
        }
      }
      if (p.x < PW / 2) p.x = PW / 2;
      if (p.x > W - PW / 2) p.x = W - PW / 2;
      for (const r of s.rects) {
        if (r.y + r.h > H - PH && r.y < H && p.x + PW / 2 > r.x && p.x - PW / 2 < r.x + r.w) {
          p.x = ox < r.x + r.w / 2 ? r.x - PW / 2 : r.x + r.w + PW / 2;
        }
      }
    }
    if (p.cd > 0) p.cd--;
    if (p.invuln > 0) p.invuln--;
    if (p.haste > 0) p.haste--;
    // Two Heads: the trigger belongs to whoever rides in this body
    const rider = s.players.findIndex((q) => q.ride === i);
    const o = rider >= 0 ? rider : i;
    if (!canFire || !p.armed || !((inputs[o] | 0) & IN_FIRE) || p.cd > 0) return;
    const w = p.weapon;
    const out = (kind: Shot['kind']) => s.shots.some((sh) => sh.owner === o && sh.kind === kind);
    const shot = (kind: Shot['kind'], x: number, y: number, more: Partial<Shot> = {}) => s.shots.push({ kind, x, y, owner: o, sticky: false, t: 0, v: 0, lim: 0, ...more });
    p.cd = 8;
    if (w === 'pulse') shot('bullet', p.x, H - PH);
    else if (w === 'beam') { shot('beam', p.x, 0, { t: 10 }); p.cd = 60; }
    else if (w === 'sword') { shot('slash', p.x, 0, { t: 8, v: p.face }); p.cd = 22; }
    else if (w === 'side') { if (out('dartx')) { p.cd = 0; return; } shot('dartx', p.x + p.face * (PW / 2), H - PH * 0.55, { v: p.face * DART_V0 }); }
    else if (w === 'rocket') { if (out('darty')) { p.cd = 0; return; } shot('darty', p.x, H - PH, { v: -DART_V0 }); }
    else if (w === 'lance') { if (out('lance')) { p.cd = 0; return; } shot('lance', p.x, H - PH); }
    else {
      let active = 0;
      for (const sh of s.shots) if (sh.owner === o && sh.kind === 'wire') active++;
      if (active >= (w === 'twin' ? 2 : 1)) { p.cd = 0; return; }
      // The tip starts at the top of the head (the line already reaches down to the floor),
      // so a ball right overhead is hit almost at once.
      shot('wire', p.x, H - PH, { sticky: w === 'anchor', lim: w === 'stub' ? H - PH - STUB_REACH : 0 });
      if (w === 'stub') p.cd = STUB_CD;
    }
    s.players[o].st.shots++;
    ev.push({ t: 'shoot', weapon: w, p: o });
  });
  // riders go wherever their body goes
  for (const p of s.players) {
    if (p.ride < 0) continue;
    const d = s.players[p.ride];
    p.x = d.x; p.face = d.face; p.weapon = d.weapon; p.shield = d.shield; p.invuln = d.invuln; p.haste = d.haste;
  }
}

function boxHit(b: Ball, x0: number, x1: number, y0: number, y1: number): boolean {
  const cx = b.x < x0 ? x0 : b.x > x1 ? x1 : b.x, cy = b.y < y0 ? y0 : b.y > y1 ? y1 : b.y;
  const dx = b.x - cx, dy = b.y - cy, r = RADII[b.size];
  return dx * dx + dy * dy < r * r;
}

/** Moves the shots. Returns the owners of shots that missed on a no-miss level. */
function stepShots(s: State, L: Level, ev: GameEvent[]): number[] {
  const spikes = hasSpikes(L);
  const missed: number[] = [];
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i];
    const stop = stopY(s, sh.x, spikes);
    let dead = false, miss = false;
    // most shots are an upright line from y0 down to y1; the sword and the floor bolt are boxes
    let y0 = sh.y, y1 = H, pad = 0, pierce = false, box: number[] | null = null;
    if (sh.kind === 'wire') {
      const top = sh.lim > 0 ? Math.max(stop, sh.lim) : stop;
      if (sh.t > 0) {
        if (--sh.t === 0) dead = true;
        if (sh.y < top) sh.y = top;
      } else {
        sh.y -= (sh.lim > 0 ? WIRE_SPEED / 2 : WIRE_SPEED) * DT;
        if (sh.y <= top) {
          sh.y = top;
          if (sh.sticky) sh.t = ANCHOR_TICKS; else dead = true;
          miss = true;
        }
      }
      y0 = sh.y; pad = 1; // a touch wider than it is drawn: a graze counts
    } else if (sh.kind === 'bullet') {
      sh.y -= BULLET_SPEED * DT;
      if (sh.y <= stop) dead = true;
      y0 = sh.y; y1 = sh.y + 16; pad = 2;
    } else if (sh.kind === 'slash') {
      if (--sh.t <= 0) dead = true;
      sh.x = s.players[sh.owner].x;
      box = [Math.min(sh.x, sh.x + sh.v * SWORD_REACH), Math.max(sh.x, sh.x + sh.v * SWORD_REACH), H - PH - 8, H];
    } else if (sh.kind === 'dartx') {
      sh.v += Math.sign(sh.v) * DART_ACC * DT;
      sh.x += sh.v * DT;
      if (sh.x < 0 || sh.x > W) dead = true;
      for (const r of s.rects) if (sh.x > r.x && sh.x < r.x + r.w && sh.y > r.y && sh.y < r.y + r.h) dead = true;
      const back = sh.x - Math.sign(sh.v) * boltTail(sh.v); // the tail pops too
      box = [Math.min(sh.x - 7, back), Math.max(sh.x + 7, back), sh.y - 3, sh.y + 3];
    } else if (sh.kind === 'darty') {
      sh.v -= DART_ACC * DT;
      sh.y += sh.v * DT;
      if (sh.y <= stop) dead = miss = true;
      y0 = sh.y; y1 = sh.y + ROCKET_LEN; pad = ROCKET_HALF; // three times the old width (pad 3)
    } else if (sh.kind === 'lance') {
      sh.y -= LANCE_SPEED * DT;
      if (sh.y <= stop) dead = true;
      y0 = sh.y; y1 = Math.min(H, sh.y + LANCE_LEN); pad = 1;
    } else {
      if (--sh.t <= 0) dead = true;
      y0 = stop; pad = 3; pierce = true;
    }
    if (miss && L.noMiss) {
      // reached the top without hitting anything: still checks for a ball on this last tick
      let grazed = false;
      for (const b of s.balls) if (b.immune <= 0 && segHit(b, sh.x, y0, y1, pad)) { grazed = true; break; }
      if (grazed) dead = false; // pops it below
      else { dead = true; missed.push(sh.owner); }
    }
    if (!dead) {
      for (let j = s.balls.length - 1; j >= 0; j--) {
        const b = s.balls[j];
        if (b.immune > 0 || !(box ? boxHit(b, box[0], box[1], box[2], box[3]) : segHit(b, sh.x, y0, y1, pad))) continue;
        if (b.armor > 0) {
          // armoured: the hit punts it away from the floor instead of popping it
          b.armor--;
          b.immune = 12;
          const punt = 0.9 * BOUNCE_V[b.size];
          b.vy = s.grav > 0 ? Math.min(b.vy, 0) - punt : Math.max(b.vy, 0) + punt;
          s.score += 5;
          s.players[sh.owner].st.score += 5;
          ev.push({ t: 'knock', x: b.x, y: b.y });
        } else pop(s, j, L, ev, s.players[sh.owner]);
        if (!pierce) { dead = true; break; }
      }
    }
    if (dead) s.shots.splice(i, 1);
  }
  return missed;
}

function stepBalls(s: State, L: Level, ev: GameEvent[]) {
  const spikes = hasSpikes(L);
  const top = s.ceilY + (spikes ? SPIKE : 0);
  const base = s.speed * (s.slowT > 0 ? 0.35 : 1);
  const up = s.grav > 0, g = G * s.grav, wind = L.wind ?? 0;
  for (let i = s.balls.length - 1; i >= 0; i--) {
    const b = s.balls[i];
    if (b.immune > 0) b.immune--;
    const scale = base * (b.fast ? FAST : 1);
    const n = Math.max(1, Math.ceil(scale * 2));
    const dt = (DT * scale) / n;
    const r = RADII[b.size], bv = BOUNCE_V[b.size];
    let gone = false;
    for (let k = 0; k < n && !gone; k++) {
      b.vy += g * dt;
      b.x += (b.vx + wind) * dt;
      b.y += b.vy * dt;
      if (b.x - r < 0) { b.x = r; b.vx = Math.abs(b.vx); }
      if (b.x + r > W) { b.x = W - r; b.vx = -Math.abs(b.vx); }
      // the surface gravity pulls toward relaunches the ball; the opposite one just reflects it
      if (b.y + r > H) { b.y = H - r; b.vy = up ? -bv : -Math.abs(b.vy); }
      for (const q of s.rects) {
        const cx = b.x < q.x ? q.x : b.x > q.x + q.w ? q.x + q.w : b.x;
        const cy = b.y < q.y ? q.y : b.y > q.y + q.h ? q.y + q.h : b.y;
        const dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy >= r * r) continue;
        if (dx === 0 && dy === 0) {
          // centre inside the block: shove out through the nearest face
          const l = b.x - q.x, rr = q.x + q.w - b.x, t = b.y - q.y, bt = q.y + q.h - b.y;
          const m = Math.min(l, rr, t, bt);
          if (m === t) { b.y = q.y - r; b.vy = up ? -bv : -Math.abs(b.vy); }
          else if (m === bt) { b.y = q.y + q.h + r; b.vy = up ? Math.abs(b.vy) : bv; }
          else if (m === l) { b.x = q.x - r; b.vx = -Math.abs(b.vx); }
          else { b.x = q.x + q.w + r; b.vx = Math.abs(b.vx); }
        } else if (Math.abs(dx) > Math.abs(dy)) {
          b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
          b.x = cx + (dx > 0 ? r : -r);
        } else if (dy < 0) {
          b.y = cy - r; b.vy = up ? -bv : -Math.abs(b.vy);
        } else {
          b.y = cy + r; b.vy = up ? Math.abs(b.vy) : bv;
        }
      }
      if (b.y - r < top) {
        if (spikes) gone = true;
        else { b.y = top + r; b.vy = up ? Math.abs(b.vy) : bv; }
      }
    }
    if (!gone && (L.portals || L.chain)) {
      if (b.pcd > 0) b.pcd--;
      else {
        // a portal is an upright oval; a ball goes in when its centre passes through it
        const rx = 16 + RADII[b.size] * 0.5, ry = 34 + RADII[b.size] * 0.6;
        const inside = (x: number, y: number) => ((b.x - x) / rx) ** 2 + ((b.y - y) / ry) ** 2 < 1;
        const out = (x: number, y: number) => {
          b.x = x; b.y = y; b.pcd = 45;
          // coming out up high: the ball drops out rather than flying into the roof
          if (y < H / 2 && s.grav > 0 && b.vy < 0) b.vy = 0;
          ev.push({ t: 'portal', x, y });
        };
        let moved = false;
        if (L.chain) {
          for (let k = 0; k < L.chain.length && !moved; k++) {
            if (inside(L.chain[k][0], L.chain[k][1])) { const nx = L.chain[(k + 1) % L.chain.length]; out(nx[0], nx[1]); moved = true; }
          }
        }
        for (const [ax, ay, bx, by] of L.portals ?? []) {
          if (moved) break;
          if (inside(ax, ay)) { out(bx, by); moved = true; } else if (inside(bx, by)) { out(ax, ay); moved = true; }
        }
      }
    }
    if (gone) {
      s.balls.splice(i, 1);
      s.score += (b.size + 1) * 25;
      ev.push({ t: 'spike', x: b.x, y: b.y, size: b.size });
    }
  }
}

function applyPickup(s: State, p: Player, kind: PickupKind, L: Level) {
  switch (kind) {
    case 'shield': p.shield = true; break;
    case 'slow': s.slowT = 300; break;
    case 'time': s.timeLeft = Math.min(L.time * 60, s.timeLeft + 600); break;
    case 'life':
      if (s.mode === 'revive') s.team = Math.min(5, s.team + 1);
      else {
        p.lives = Math.min(5, p.lives + 1);
        for (const q of s.players) if (q.ride === s.players.indexOf(p)) q.lives = p.lives; // a shared body shares its lives
      }
      break;
    case 'master': for (const q of s.players) q.master = q === p; break;
    case 'haste': p.haste = 8 * 60; break;
    default: p.weapon = kind;
  }
}

export function step(s: State, inputs: number[], levels: Level[], ev: GameEvent[]) {
  // Pause travels through the inputs like everything else, so it stays in sync online.
  let pauseHit = false;
  for (const i of inputs) if (i & IN_PAUSE) pauseHit = true;
  if (pauseHit && s.phase !== 'over' && s.phase !== 'won') s.paused = !s.paused;
  s.tick++;
  if (s.paused) return;
  const L = levelAt(s, levels);
  switch (s.phase) {
    case 'ready':
      stepPlayers(s, inputs, L, ev, false);
      if (--s.phaseT <= 0) { s.phase = 'play'; ev.push({ t: 'start' }); }
      return;
    case 'dead':
      if (--s.phaseT <= 0) {
        const alive = s.mode === 'revive' ? s.team > 0 : s.players.filter((p) => p.lives > 0).length >= (s.mode === 'versus' ? 2 : 1);
        if (alive) loadLevel(s, levels);
        else s.phase = s.mode === 'versus' && s.players.some((p) => p.lives > 0) ? 'won' : 'over';
      }
      return;
    case 'clear':
      if (--s.phaseT <= 0) {
        if (s.mode === 'versus') {
          // game over when someone has enough round wins or only one player has lives left
          if (s.players.some((p) => p.wins >= VERSUS_WINS) || s.players.filter((p) => p.lives > 0).length < 2) s.phase = 'won';
          else { s.level++; loadLevel(s, levels); }
        } else if (!s.players.some((p) => p.lives > 0)) s.phase = 'over';
        else if (s.level + 1 >= levels.length) s.phase = 'won';
        else {
          s.level++;
          if (levels[s.level].floor !== levels[s.level - 1].floor) { // a checkpoint
            for (const p of s.players) p.lives = Math.max(3, p.lives);
            s.team = Math.max(3, s.team);
          }
          loadLevel(s, levels);
        }
      }
      return;
    case 'over':
    case 'won':
      return;
  }

  // --- play ---
  stepPlayers(s, inputs, L, ev, true);
  if (s.slowT > 0) s.slowT--;
  if (L.ramp) s.speed = Math.min(2.2, s.speed + L.ramp * DT);
  if (L.ceiling) s.ceilY += L.ceiling.speed * DT;
  s.lt++;
  if (L.flip && s.lt % (L.flip * 60) === 0) { s.grav = -s.grav; ev.push({ t: 'flip' }); }
  for (const r of s.rects) {
    if (!r.move) continue;
    const T = r.move.period * 60, ph = (s.lt % T) / T, k = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    r.x = r.bx + r.move.dx * k;
    r.y = r.by + r.move.dy * k;
  }
  const missed = stepShots(s, L, ev);
  stepBalls(s, L, ev);

  // gates open once every ball of their group is gone
  for (let i = s.rects.length - 1; i >= 0; i--) {
    const g = s.rects[i].gate;
    if (g === undefined) continue;
    let alive = false;
    for (const b of s.balls) if (b.group === g) { alive = true; break; }
    if (!alive) { s.rects.splice(i, 1); ev.push({ t: 'gate' }); }
  }

  // pickups
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const pk = s.pickups[i];
    if (pk.y < H - 12) pk.y = Math.min(H - 12, pk.y + 160 * DT);
    else if (--pk.t <= 0) { s.pickups.splice(i, 1); continue; }
    if (pk.y > H - PH - 10) {
      // If several players are touching it on the same tick, it goes to one of them at
      // random (even odds), not to whoever has the lowest player number.
      const takers = s.players.filter((p) => !p.down && p.ride < 0 && Math.abs(p.x - pk.x) < PW / 2 + 12);
      if (takers.length) {
        const p = takers.length === 1 ? takers[0] : takers[Math.floor(rand(s) * takers.length)];
        applyPickup(s, p, pk.kind, L);
        p.st.picks++;
        p.st.got |= 1 << PICKUP_KINDS.indexOf(pk.kind);
        ev.push({ t: 'pickup', kind: pk.kind });
        s.pickups.splice(i, 1);
      }
    }
  }

  // A hit costs that player one of their own lives and sits them out for this attempt.
  // The others play on; the level only restarts once everyone is down.
  // (Revive mode: no life is lost yet. The player waits in a circle to be revived.)
  const revive = s.mode === 'revive';
  const fell = (p: Player) => {
    if (p.down) return;
    p.down = true;
    p.st.deaths++;
    ev.push({ t: 'die', x: p.x });
    if (revive) { p.rt = REVIVE_TICKS; p.rp = 0; p.rr = REVIVE_RATES[Math.min(s.falls++, REVIVE_RATES.length - 1)]; return; }
    p.lives--;
    s.lost++;
    // Two Heads: both players in a body go down together
    const me = s.players.indexOf(p);
    for (const q of s.players) if (q.ride === me || p.ride === s.players.indexOf(q)) fell(q);
    if (p.vip) {
      // Protect the VIP: losing them costs everyone still standing a life and ends the attempt
      for (const q of s.players) if (!q.down) fell(q);
    } else if (p.armed && s.mode === 'onegun') {
      // the gun passes to a random player who is still standing
      p.armed = false;
      const standing = s.players.filter((q) => !q.down);
      if (standing.length) {
        const next = standing[Math.floor(rand(s) * standing.length)];
        next.armed = true;
        ev.push({ t: 'handoff', x: next.x });
      }
    }
  };
  // No-miss levels: a shot that reached the top without hitting anything (a shield doesn't help)
  for (const o of missed) fell(s.players[o]);
  for (const p of s.players) if (!p.down) p.st.alive++;

  // Revive mode: stand in a fallen teammate's circle to bring them back before their time runs out
  if (revive) {
    for (const p of s.players) {
      if (!p.down || p.rt <= 0) continue;
      const helper = s.players.find((q) => !q.down && Math.abs(q.x - p.x) < REVIVE_R);
      if (helper) p.rp += p.rr; else p.rp = Math.max(0, p.rp - 1);
      if (p.rp >= REVIVE_NEED) {
        p.down = false; p.rt = 0; p.rp = 0; p.invuln = 120;
        if (helper) helper.st.revives++;
        ev.push({ t: 'revive', x: p.x });
      } else if (--p.rt <= 0) {
        for (const q of s.players) if (!q.down) fell(q); // out of time: the whole team goes down
      }
    }
  }

  for (const p of s.players) {
    if (p.down || p.invuln > 0 || p.ride >= 0) continue;
    const x0 = p.x - PW / 2 + 3, x1 = p.x + PW / 2 - 3, y0 = H - PH + 4;
    let gap = 1e9, hit = false;
    for (const b of s.balls) {
      const cx = b.x < x0 ? x0 : b.x > x1 ? x1 : b.x;
      const cy = b.y < y0 ? y0 : b.y > H ? H : b.y;
      const dx = b.x - cx, dy = b.y - cy, r = RADII[b.size] - 1;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) { hit = true; break; }
      if (d2 < (r + 40) * (r + 40)) gap = Math.min(gap, Math.sqrt(d2) - r);
    }
    if (hit) {
      if (p.shield) { p.shield = false; p.invuln = 100; ev.push({ t: 'shield' }); }
      else fell(p);
    } else if (gap < 16) {
      // for the "most reckless" and "closest shave" awards
      p.st.danger++;
      if (gap < p.st.shave) p.st.shave = Math.max(0, Math.round(gap * 10) / 10);
    }
  }
  // the roof and the clock take everyone still standing
  let all = s.ceilY + (hasSpikes(L) ? SPIKE : 0) >= H - PH;
  if (--s.timeLeft <= 0) { s.timeLeft = 0; all = true; }
  if (all) for (const p of s.players) if (!p.down) fell(p);

  const standing = s.players.filter((p) => !p.down);
  if (s.mode === 'versus') {
    // a round goes to whoever clears their lane, or to the last player standing
    const lane = W / s.players.length;
    let winners = standing.filter((p) => !s.balls.some((b) => Math.floor(b.x / lane) === s.players.indexOf(p)));
    if (!winners.length && standing.length === 1) winners = standing;
    if (winners.length) {
      for (const p of winners) p.wins++;
      s.phase = 'clear';
      s.phaseT = 120;
      ev.push({ t: 'clear' });
    } else if (!standing.length) {
      s.phase = 'dead';
      s.phaseT = 90;
    }
    return;
  }
  // Revive: everyone has to be back on their feet before the level counts as cleared
  if (s.balls.length === 0 && (!revive || standing.length === s.players.length)) {
    s.phase = 'clear';
    s.phaseT = 120;
    // the last level of a floor: a short ceremony before the next one
    if (L.floor && levels[s.level + 1]?.floor !== L.floor) { s.phaseT = FLOOR_UP_TICKS; ev.push({ t: 'floor' }); }
    s.score += Math.floor(s.timeLeft / 60) * 10;
    s.hist.push([s.level, s.lt, 1, s.lost]);
    ev.push({ t: 'clear' });
  } else if (!standing.length) {
    if (revive) { s.team--; s.lost++; }
    s.phase = 'dead';
    s.phaseT = 90;
    s.hist.push([s.level, s.lt, 0, s.lost]);
  }
}
