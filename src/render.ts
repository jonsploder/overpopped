import { FLOOR_UP_TICKS, H, PH, PW, RADII, W, hasSpikes, levelAt, stopY } from './sim';
import { FLOORS, FLOOR_START } from './levels';
import { clock, longTime } from './stats';
import type { Lifetime } from './stats';
import type { GameEvent, Level, PickupKind, State, Mode } from './sim';
import { boltTail, LANCE_LEN, ROCKET_HALF, ROCKET_LEN, MODES, REVIVE_NEED, REVIVE_R, REVIVE_TICKS, SWORD_REACH, TETHER, VERSUS_WINS, roped } from './sim';

export const VIEW_W = W;
export const VIEW_H = H + 60;

const BALL_COL = ['#ffe066', '#ff9f43', '#ff5e7e', '#c56cf0', '#4dabf7', '#38d9a9'];
const PLAYER_COL = ['#5ee6ff', '#ff7ad9', '#b6ff6e', '#ffd166'];
const PICK: Record<PickupKind, { c: string; label: string; name: string }> = {
  harpoon: { c: '#e9ecef', label: 'H', name: 'Harpoon' },
  twin: { c: '#74c0fc', label: '2', name: 'Twin harpoon' },
  anchor: { c: '#8ce99a', label: 'V', name: 'Sticky vine' },
  pulse: { c: '#ffa94d', label: 'P', name: 'Pulse gun' },
  beam: { c: '#ff6b6b', label: 'B', name: 'Beam' },
  shield: { c: '#66d9e8', label: 'S', name: 'Shield' },
  slow: { c: '#b197fc', label: '~', name: 'Slow' },
  time: { c: '#ffd43b', label: '+', name: 'Time' },
  life: { c: '#ff8787', label: '♥', name: 'Life' },
  haste: { c: '#fcc419', label: '!', name: 'Haste' },
  stub: { c: '#ced4da', label: 'h', name: 'Short harpoon' },
  sword: { c: '#ffd8a8', label: '/', name: 'Sword' },
  side: { c: '#63e6be', label: '>', name: 'Floor bolt' },
  rocket: { c: '#ffa8a8', label: '^', name: 'Rocket' },
  lance: { c: '#91a7ff', label: '|', name: 'Lance' },
  master: { c: '#e0b56e', label: '@', name: 'Rope master' },
};

interface Particle { x: number; y: number; vx: number; vy: number; life: number; c: string }
const particles: Particle[] = [];

/** Touch devices get tap-flavoured prompts and a close button. */
let touch = false;
export function setTouch(v: boolean) { touch = v; }
/** Top-right close/back button (touch only), in view coordinates. */
export const CLOSE_BTN = { x: W - 56, y: 8, w: 48, h: 48 };

function closeButton(ctx: CanvasRenderingContext2D, icon: 'x' | 'pause' | 'play' = 'x') {
  if (!touch) return;
  const b = CLOSE_BTN;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  if (icon !== 'x') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    if (icon === 'pause') { ctx.fillRect(b.x + 16, b.y + 15, 5, 18); ctx.fillRect(b.x + 27, b.y + 15, 5, 18); }
    else { ctx.beginPath(); ctx.moveTo(b.x + 18, b.y + 14); ctx.lineTo(b.x + 34, b.y + 24); ctx.lineTo(b.x + 18, b.y + 34); ctx.fill(); }
    return;
  }
  ctx.beginPath();
  ctx.moveTo(b.x + 16, b.y + 16); ctx.lineTo(b.x + 32, b.y + 32);
  ctx.moveTo(b.x + 32, b.y + 16); ctx.lineTo(b.x + 16, b.y + 32);
  ctx.stroke();
}

/** Touch controls, shown over the two halves of the screen: slide on the left to move, hold on the right to fire. */
function drawTouchGuide(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ([[W * 0.25, 'SLIDE TO MOVE'], [W * 0.75, 'HOLD TO FIRE']] as const).forEach(([x, label], i) => {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.roundRect(x - 170, 300, 340, 110, 16); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle = '#cfd4ff';
    ctx.lineWidth = 3;
    const y = 338;
    if (i === 0) {
      // a thumb with an arrow either side
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
      for (const d of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x + d * 24, y); ctx.lineTo(x + d * 58, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + d * 68, y); ctx.lineTo(x + d * 54, y - 9); ctx.lineTo(x + d * 54, y + 9); ctx.fill();
      }
    } else {
      // a thumb pressed down, and a harpoon going up
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.stroke();
    }
    text(ctx, label, x, 388, 18, '#cfd4ff');
  });
  ctx.restore();
}

export function drawRotate(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'TURN YOUR PHONE SIDEWAYS', W / 2, VIEW_H / 2, 54, '#ffd43b');
}
let shake = 0;
const otherX = [0, 0, 0, 0]; // smoothed draw positions of the remote players
const COLOR_NAMES = ['blue', 'pink', 'green', 'yellow'];

export function fxEvents(ev: GameEvent[]) {
  for (const e of ev) {
    if (e.t === 'pop' || e.t === 'spike') {
      const n = 5 + e.size * 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
        particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.3 + Math.random() * 0.3, c: BALL_COL[e.size] });
      }
    } else if (e.t === 'knock') {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.25, c: '#dee2e6' });
      }
    } else if (e.t === 'flip') shake = 0.25;
    else if (e.t === 'die') shake = 0.4;
    else if (e.t === 'gate') shake = 0.2;
  }
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', weight = 700) {
  ctx.font = `${weight} ${size}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d1024');
  g.addColorStop(1, '#1a1236');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 40; x < W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 40; y < H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

export function drawGame(ctx: CanvasRenderingContext2D, s: State, L: Level, where: string, dt: number, waiting = false, net?: { you: number; status: string }, corner: string[] = [], teach = false) {
  ctx.save();
  if (shake > 0) {
    shake -= dt;
    ctx.translate((Math.random() - 0.5) * 10 * shake * 2.5, (Math.random() - 0.5) * 10 * shake * 2.5);
  }
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (L.upsideDown) {
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-W / 2, -H / 2);
  }
  if (L.spin) {
    // half a turn at the end of every period, eased over 45 ticks
    const P = L.spin * 60, n = Math.floor(s.lt / P), into = s.lt - n * P - (P - 45);
    const k = into > 0 ? into / 45 : 0;
    ctx.fillStyle = '#07080f';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.PI * (n + k * k * (3 - 2 * k)));
    ctx.translate(-W / 2, -H / 2);
  }
  background(ctx);
  const spiked = hasSpikes(L);

  if (L.wind) {
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const y = 30 + ((i * 97) % (H - 60));
      const x = (((i * 211 + s.tick * L.wind * 0.05 * (1 + (i % 3) * 0.4)) % (W + 80)) + W + 80) % (W + 80) - 40;
      ctx.moveTo(x, y); ctx.lineTo(x - Math.sign(L.wind) * (24 + (i % 4) * 10), y);
    }
    ctx.stroke();
  }
  if (L.flip) {
    // arrows show which way balls fall; they flash in the last second before a flip
    const left = L.flip * 60 - (s.lt % (L.flip * 60));
    if (!(left < 60 && left % 12 < 6)) {
      ctx.fillStyle = left < 60 ? '#ffd43b' : 'rgba(255,255,255,0.16)';
      for (const ax of [30, W - 30]) for (const ay of [150, 240, 330]) {
        ctx.beginPath();
        ctx.moveTo(ax - 10, ay - 8 * s.grav); ctx.lineTo(ax + 10, ay - 8 * s.grav); ctx.lineTo(ax, ay + 10 * s.grav);
        ctx.fill();
      }
    }
  }

  // roof
  {
    ctx.fillStyle = '#2b2f55';
    ctx.fillRect(0, -20, W, s.ceilY + 20);
    ctx.fillStyle = spiked ? '#ff6b6b' : '#5c63a8';
    if (spiked) {
      ctx.beginPath();
      for (let x = 0; x < W; x += 16) { ctx.moveTo(x, s.ceilY); ctx.lineTo(x + 8, s.ceilY + 9); ctx.lineTo(x + 16, s.ceilY); }
      ctx.fill();
    } else ctx.fillRect(0, s.ceilY - 3, W, 3);
    if (L.noMiss) {
      // no misses: the roof glows red, a shot that reaches it costs a life
      const top = s.ceilY + (spiked ? 9 : 0), g = ctx.createLinearGradient(0, top, 0, top + 34);
      const a = 0.32 + 0.12 * Math.sin(s.tick * 0.08);
      g.addColorStop(0, `rgba(255,60,60,${a})`);
      g.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, W, 34);
      // ...and is hung with skulls
      for (let x = 40; x < W; x += 80) {
        const y = top + 13;
        ctx.fillStyle = '#e9dcc9';
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 5, y + 4, 10, 8);
        ctx.fillStyle = '#1a0a0e';
        ctx.beginPath(); ctx.arc(x - 3.2, y + 0.5, 2.4, 0, Math.PI * 2); ctx.arc(x + 3.2, y + 0.5, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x - 1.4, y + 6); ctx.lineTo(x + 1.4, y + 6); ctx.fill();
        ctx.fillRect(x - 2.6, y + 8, 1, 4); ctx.fillRect(x - 0.5, y + 8, 1, 4); ctx.fillRect(x + 1.6, y + 8, 1, 4);
      }
    }
  }

  // blocks
  for (const r of s.rects) {
    const gate = r.gate !== undefined;
    ctx.fillStyle = gate ? '#3b2f1a' : '#30355f';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = gate ? '#ffb84d' : '#7d86d6';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }

  // shots
  for (const sh of s.shots) {
    const col = PLAYER_COL[sh.owner % PLAYER_COL.length];
    if (sh.kind === 'wire') {
      ctx.strokeStyle = sh.sticky ? '#8ce99a' : col;
      ctx.lineWidth = sh.sticky ? 3 : 2;
      ctx.globalAlpha = sh.t > 0 && sh.t < 40 && sh.t % 8 < 4 ? 0.35 : 1;
      ctx.beginPath();
      // wavy line
      ctx.moveTo(sh.x, H);
      for (let y = H; y > sh.y; y -= 8) ctx.lineTo(sh.x + ((y / 8) & 1 ? 2 : -2), y);
      ctx.lineTo(sh.x, sh.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(sh.x - 5, sh.y + 8); ctx.lineTo(sh.x, sh.y); ctx.lineTo(sh.x + 5, sh.y + 8); ctx.fill();
    } else if (sh.kind === 'bullet') {
      ctx.fillStyle = '#ffa94d';
      ctx.fillRect(sh.x - 2, sh.y, 4, 14);
    } else if (sh.kind === 'slash') {
      // a quick arc in front of the body
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.globalAlpha = Math.min(1, sh.t / 5);
      ctx.beginPath(); ctx.arc(sh.x, H - 16, SWORD_REACH - 2, sh.v > 0 ? -1.25 : Math.PI - 0.35, sh.v > 0 ? 0.35 : Math.PI + 1.25); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (sh.kind === 'dartx') {
      const d = Math.sign(sh.v), tail = boltTail(sh.v);
      ctx.fillStyle = col; ctx.globalAlpha = 0.7;
      ctx.fillRect(Math.min(sh.x, sh.x - d * tail), sh.y - 1.5, tail, 3);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(sh.x + d * 8, sh.y); ctx.lineTo(sh.x - d * 5, sh.y - 5); ctx.lineTo(sh.x - d * 5, sh.y + 5); ctx.fill();
    } else if (sh.kind === 'darty') {
      const tail = Math.min(60, Math.abs(sh.v) * 0.05), r = ROCKET_HALF, x = sh.x, y = sh.y, end = y + ROCKET_LEN;
      // exhaust
      ctx.fillStyle = col; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, end); ctx.lineTo(x + r * 0.7, end); ctx.lineTo(x, end + tail); ctx.fill();
      ctx.globalAlpha = 1;
      // fins
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x - r, end - 10); ctx.lineTo(x - r - 6, end + 2); ctx.lineTo(x - r, end); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + r, end - 10); ctx.lineTo(x + r + 6, end + 2); ctx.lineTo(x + r, end); ctx.fill();
      // body and nose
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r, y + 10); ctx.lineTo(x + r, end); ctx.lineTo(x - r, end); ctx.lineTo(x - r, y + 10); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y + 15, 3.5, 0, Math.PI * 2); ctx.fill();
    } else if (sh.kind === 'lance') {
      const y1 = Math.min(H, sh.y + LANCE_LEN);
      ctx.fillStyle = col; ctx.globalAlpha = 0.35;
      ctx.fillRect(sh.x - 3, sh.y, 6, y1 - sh.y);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
      ctx.fillRect(sh.x - 1, sh.y, 2, y1 - sh.y);
    } else {
      const top = stopY(s, sh.x, spiked);
      ctx.fillStyle = `rgba(255,107,107,${0.25 + sh.t / 14})`;
      ctx.fillRect(sh.x - 5, top, 10, H - top);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sh.x - 1.5, top, 3, H - top);
    }
  }

  // pickups
  for (const pk of s.pickups) {
    if (pk.t < 90 && pk.t % 12 < 6) continue;
    drawToken(ctx, pk.kind, pk.x, pk.y - 3 + Math.sin(s.tick * 0.12 + pk.x) * 2, 14);
  }

  // portals: pairs are orange and blue (both work both ways); a chain is numbered 1 -> 2 -> 3 -> 1
  const CHAIN_COL = ['#ff922b', '#cc5de8', '#4dabf7', '#51cf66', '#ffd43b'];
  const portalList: [number, number, string, string][] = [];
  (L.portals ?? []).forEach(([ax, ay, bx, by]) => { portalList.push([ax, ay, '#ff922b', ''], [bx, by, '#4dabf7', '']); });
  (L.chain ?? []).forEach(([x, y], k) => portalList.push([x, y, CHAIN_COL[k % CHAIN_COL.length], String(k + 1)]));
  if (portalList.length) {
    portalList.forEach(([px, py, pc, label]) => {
      for (const [x, y, c] of [[px, py, pc]] as [number, number, string][]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = c;
        ctx.shadowColor = c;
        ctx.shadowBlur = 14;
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = 0.9 - k * 0.25;
          ctx.lineWidth = 3 - k;
          ctx.beginPath(); ctx.ellipse(0, 0, 22 - k * 5, 34 - k * 8, 0, s.tick * 0.08 + k, s.tick * 0.08 + k + Math.PI * 1.5); ctx.stroke();
        }
        ctx.restore();
        if (label) text(ctx, label, x, y + 1, 15, c);
      }
    });
  }

  // Tethered: a rope between neighbouring players, sagging when slack and taut when stretched
  if (roped(s.mode)) {
    for (let i = 0; i + 1 < s.players.length; i++) {
      const a = s.players[i], b = s.players[i + 1];
      if (a.down || b.down) continue;
      const span = Math.abs(b.x - a.x), sag = Math.max(0, 1 - span / TETHER) * 40, y = H - PH / 2;
      ctx.strokeStyle = span > TETHER - 12 ? '#ff8787' : '#c9a66b';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, y); ctx.quadraticCurveTo((a.x + b.x) / 2, y + sag, b.x, y); ctx.stroke();
      // whoever holds the rope has it wound round a fist
      for (const m of [a, b]) if (m.master) { ctx.fillStyle = '#e0b56e'; ctx.beginPath(); ctx.arc(m.x, y, 7, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  // Revive: a circle to stand in, a countdown bar, and progress
  if (s.mode === 'revive') {
    s.players.forEach((p, i) => {
      if (!p.down || p.rt <= 0) return;
      const col = PLAYER_COL[i % PLAYER_COL.length], left = p.rt / REVIVE_TICKS;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.ellipse(p.x, H - 4, REVIVE_R, 9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x - 30, H - PH - 30, 60, 8);
      ctx.fillStyle = left < 0.33 && s.tick % 20 < 10 ? '#ff6b6b' : left < 0.33 ? '#ffa8a8' : '#ffd43b';
      ctx.fillRect(p.x - 30, H - PH - 30, 60 * left, 8);
      if (p.rp > 0) {
        ctx.strokeStyle = '#8ce99a';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x, H - PH / 2, 26, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.rp) / REVIVE_NEED); ctx.stroke();
      }
      text(ctx, `${Math.ceil(p.rt / 60)}`, p.x, H - PH - 44, 14, '#fff');
      ctx.restore();
    });
  }

  // balls
  const splitsVary = s.balls.some((b) => b.split !== 2) || !!L.split || L.balls.some((b) => b.split !== undefined);
  for (const b of s.balls) {
    const r = RADII[b.size];
    const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.35, r * 0.1, b.x, b.y, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.25, BALL_COL[b.size]);
    g.addColorStop(1, shade(BALL_COL[b.size]));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
    if (b.fast) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(b.x, b.y, r + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (let a = 0; a < b.armor; a++) {
      ctx.strokeStyle = a % 2 ? '#868e96' : '#dee2e6';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, r - 2 - a * 4, 0, Math.PI * 2); ctx.stroke();
    }
    // how many pieces it splits into, when that isn't the usual two (or when the level mixes them)
    if (b.size > 0 && splitsVary) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      text(ctx, String(b.split), b.x, b.y + 1, Math.max(10, Math.min(26, r * 0.9)), b.split === 2 ? 'rgba(255,255,255,0.75)' : '#ffffff');
      ctx.restore();
    }
  }

  // players
  s.players.forEach((pl, i) => {
    if (pl.lives <= 0 && pl.down) return; // out of the game
    if (pl.ride >= 0) return; // rides in someone else's body
    if (pl.invuln > 0 && pl.invuln % 8 < 4) return;
    if (s.mode === 'revive' && pl.down && pl.rt <= 0) return;
    if (pl.haste > 0 && !pl.down) {
      // speed lines behind a hasted player
      ctx.fillStyle = PLAYER_COL[i % PLAYER_COL.length];
      for (let k = 1; k <= 3; k++) {
        ctx.globalAlpha = 0.25 - k * 0.06;
        ctx.fillRect(pl.x - PW / 2 - pl.face * k * 9, H - PH + 8, PW, PH - 8);
      }
    }
    ctx.globalAlpha = pl.down ? 0.22 : 1; // hit on this attempt: a ghost where they fell
    // Online, the other player's position is a prediction that gets corrected. Ease toward
    // it instead of snapping, so corrections read as a quick slide rather than a teleport.
    let px = pl.x;
    if (net && i !== net.you) {
      if (s.phase !== 'play' || Math.abs(px - otherX[i]) > 160) otherX[i] = px;
      else { otherX[i] += (px - otherX[i]) * 0.4; px = otherX[i]; }
    }
    const p = { x: px, face: pl.face, shield: pl.shield };
    const col = PLAYER_COL[i % PLAYER_COL.length];
    const x = p.x - PW / 2, y = H - PH;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.roundRect(x, y + 6, PW, PH - 6, [10, 10, 4, 4]); ctx.fill();
    ctx.fillStyle = '#10122a';
    ctx.beginPath(); ctx.roundRect(x + 4, y + 13, PW - 8, 12, 5); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x - 5 + p.face * 2, y + 16, 3, 6);
    ctx.fillRect(p.x + 2 + p.face * 2, y + 16, 3, 6);
    const rider = s.players.findIndex((q) => q.ride === i);
    if (rider >= 0) {
      // two heads: the gunner's colour on the lower half, and a second antenna
      ctx.fillStyle = PLAYER_COL[rider % PLAYER_COL.length];
      ctx.beginPath(); ctx.roundRect(x, y + 28, PW, PH - 28, [0, 0, 4, 4]); ctx.fill();
      ctx.fillRect(p.x + 4.5, y, 3, 8);
      ctx.fillStyle = col;
      ctx.fillRect(p.x - 7.5, y, 3, 8);
    } else {
      ctx.fillStyle = col;
      ctx.fillRect(p.x - 1.5, y, 3, 8); // antenna
    }
    if (s.mode === 'onegun' || s.mode === 'vip') drawRole(ctx, pl.vip ? 'vip' : pl.armed && s.mode === 'onegun' ? 'gun' : '', p.x, y, s.tick);
    if (net && net.you === i && s.phase === 'ready') {
      ctx.beginPath(); ctx.moveTo(p.x - 8, y - 22); ctx.lineTo(p.x + 8, y - 22); ctx.lineTo(p.x, y - 10); ctx.fill();
    }
    if (p.shield) {
      ctx.strokeStyle = '#66d9e8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, H - PH / 2, 32, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  if (s.slowT > 0) { ctx.fillStyle = 'rgba(177,151,252,0.08)'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();

  // HUD
  ctx.fillStyle = '#0a0b18';
  ctx.fillRect(0, H, W, 60);
  ctx.fillStyle = '#7d86d6';
  ctx.fillRect(0, H, W, 2);
  const frac = s.timeLeft / (L.time * 60);
  ctx.fillStyle = '#1c1f3d';
  ctx.fillRect(20, H + 12, W - 40, 10);
  ctx.fillStyle = frac < 0.25 ? '#ff6b6b' : '#ffd43b';
  ctx.fillRect(20, H + 12, (W - 40) * frac, 10);
  text(ctx, s.mode === 'versus' ? `${L.name}  -  first to ${VERSUS_WINS}` : `${where}  ${L.name}`, 20, H + 42, 16, '#cfd4ff', 'left');
  if (s.mode === 'revive') text(ctx, `team ${'♥'.repeat(Math.max(0, s.team))}`, W - 110, H + 42, 16, '#ff8787', 'right');
  text(ctx, String(s.score).padStart(6, '0'), W - 20, H + 42, 18, '#fff', 'right');
  s.players.forEach((p, i) => {
    // one block per player: weapon icon, then their own lives in their own colour
    const hx = 300 + (i * 500) / s.players.length;
    ctx.globalAlpha = p.lives > 0 ? 1 : 0.3;
    if (p.vip) drawRole(ctx, 'vip', hx, H + 46, 0, 0.8);
    else {
      if (!p.armed) ctx.globalAlpha *= 0.3; // can't shoot in this mode
      drawToken(ctx, p.weapon, hx, H + 42, 11);
      ctx.globalAlpha = p.lives > 0 ? 1 : 0.3;
    }
    // lives on top, the weapon's name underneath
    const label = s.mode === 'revive' ? '' : p.lives > 0 ? '♥'.repeat(p.lives) : 'out';
    const ly = p.vip ? H + 43 : H + 36;
    text(ctx, label, hx + 18, ly, p.lives > 0 ? 15 : 12, PLAYER_COL[i % PLAYER_COL.length], 'left');
    const after = hx + 18 + (label.length ? label.length * 10 + 6 : 0);
    if (s.mode === 'versus') text(ctx, '★'.repeat(p.wins) + '☆'.repeat(Math.max(0, VERSUS_WINS - p.wins)), after, ly, 13, '#ffd43b', 'left');
    else if (p.haste > 0) text(ctx, 'HASTE', after, ly, 11, '#fcc419', 'left');
    if (!p.vip) {
      if (!p.armed) ctx.globalAlpha *= 0.4;
      text(ctx, PICK[p.weapon].name, hx + 18, H + 52, 12, PICK[p.weapon].c, 'left', 400);
    }
    ctx.globalAlpha = 1;
  });

  if (net) text(ctx, net.status, W / 2, H + 22, 11, net.status.startsWith('OUT') ? '#ff6b6b' : '#8a90c7', 'center', 400);
  // top-left corner: the music playing, and the ping online
  ctx.globalAlpha = 0.75;
  corner.forEach((line, i) => text(ctx, line, 12, 26 + i * 15, 12, '#aab0e0', 'left', 400)); // below the roof spikes
  ctx.globalAlpha = 1;

  // overlays
  if (s.phase === 'ready') {
    if (net) text(ctx, `You are ${COLOR_NAMES[net.you]}`, W / 2, 275, 16, PLAYER_COL[net.you]);
    if (s.mode !== 'classic' && s.mode !== 'versus') {
      const me = net ? s.players[net.you] : undefined;
      const roles = s.mode === 'onegun' || s.mode === 'vip';
      const duo = s.mode === 'duo' && me ? (me.ride >= 0 ? 'You shoot' : s.players.some((q) => q.ride === net!.you) ? 'You move' : '') : '';
      const role = duo ? duo : me && roles ? (me.vip ? 'You are the VIP. Stay alive!' : me.armed ? (s.mode === 'onegun' ? 'You have the gun!' : 'Protect the VIP!') : 'No gun. Dodge!') : '';
      text(ctx, role || MODES.find((x) => x.id === s.mode)!.hint, W / 2, 302, 16, '#ffd43b', 'center', role ? 700 : 400);
    }
    if (s.mode !== 'versus' && L.floor && / 1\//.test(where)) text(ctx, `FLOOR ${L.floor}`, W / 2, 140, 18, '#ffd43b');
    text(ctx, L.name, W / 2, 190, 40);
  } else if (s.phase === 'clear' && L.floor && s.phaseT <= FLOOR_UP_TICKS && isFloorEnd(L)) drawFloorUp(ctx, s, L.floor - 1);
  else if (s.phase === 'clear') text(ctx, 'CLEAR!', W / 2, 200, 48, '#8ce99a');
  else if (s.phase === 'over') overlay(ctx, 'GAME OVER', '#ff6b6b', `Score ${s.score}`);
  else if (s.phase === 'won') overlay(ctx, 'YOU WIN', '#ffd43b', `Score ${s.score}`);
  if (s.paused) {
    const quit = net ? 'quit to lobby' : 'quit to menu';
    ctx.fillStyle = 'rgba(7,8,15,0.88)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSED', W / 2, 70, 40, '#fff');
    text(ctx, net ? 'Paused for everyone' : (touch && L.touchHint) || (L.hint ?? ''), W / 2, 106, 14, '#8a90c7', 'center', 400);
    // the rules of the mode being played (classic needs none)
    const m = MODES.find((x) => x.id === s.mode);
    if (m && m.id !== 'classic') {
      text(ctx, m.name, W / 2, 150, 16, '#ffd43b');
      wrap(ctx, m.hint, 13, 640).slice(0, 2).forEach((l, i) => text(ctx, l, W / 2, 172 + i * 17, 13, '#cfd4ff', 'center', 400));
    }
    // this run so far
    let ticks = s.lt;
    for (const h of s.hist) ticks += h[1];
    const secs = Math.floor(ticks / 60), pops = s.players.reduce((a, p) => a + p.st.pops, 0), deaths = s.players.reduce((a, p) => a + p.st.deaths, 0);
    const stats: [string, string][] = [
      [s.mode === 'versus' ? 'Round' : where.includes('·') ? 'Floor' : 'Level', s.mode === 'versus' ? String(s.level + 1) : where],
      ['Run time', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`],
      ['Popped', String(pops)],
      ['Deaths', String(deaths)],
    ];
    stats.forEach(([k, val], i) => {
      const x = W / 2 + (i - 1.5) * 170;
      text(ctx, k.toUpperCase(), x, 250, 12, '#8a90c7');
      text(ctx, val, x, 278, 22, '#fff');
    });
    text(ctx, L.name, W / 2, 322, 15, '#cfd4ff', 'center', 400);
    if (touch) {
      text(ctx, 'RESUME', W * 0.2, 418, 26, '#8ce99a');
      text(ctx, 'SETTINGS', W * 0.5, 418, 26, '#cfd4ff');
      text(ctx, 'QUIT', W * 0.8, 418, 26, '#ff8787');
    } else text(ctx, `Enter: resume      S: settings      Q: ${quit}`, W / 2, 418, 16, '#cfd4ff', 'center', 400);
  }
  // touch, first game in a while: the controls, until a few seconds into the first level
  if (touch && teach && !s.paused && (s.phase === 'ready' || (s.phase === 'play' && s.lt < 360))) drawTouchGuide(ctx, s.phase === 'ready' ? 1 : Math.min(1, (360 - s.lt) / 60));
  if (waiting) overlay(ctx, 'WAITING', '#fff', touch ? 'for the other player...' : 'for the other player...   Esc: lobby');
  closeButton(ctx, waiting || s.phase === 'over' || s.phase === 'won' ? 'x' : s.paused ? 'play' : 'pause');
}

/** Round pickup token with a drawn icon. `r` is the token radius. */
function drawToken(ctx: CanvasRenderingContext2D, kind: PickupKind, x: number, y: number, r: number) {
  const c = PICK[kind].c;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#12142e';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.scale(r / 14, r / 14);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const arrow = (ax: number) => {
    ctx.beginPath(); ctx.moveTo(ax, 8); ctx.lineTo(ax, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax - 3.5, -3); ctx.lineTo(ax, -9); ctx.lineTo(ax + 3.5, -3); ctx.closePath(); ctx.fill();
  };
  switch (kind) {
    case 'harpoon': arrow(0); break;
    case 'twin': arrow(-4); arrow(4); break;
    case 'anchor': { // vine: wavy stem, two leaves, grapple at the top
      ctx.beginPath(); ctx.moveTo(0, 9);
      ctx.bezierCurveTo(-5, 5, 5, 1, 0, -3); ctx.lineTo(0, -6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(-5, -8); ctx.lineTo(5, -8); ctx.lineTo(5, -5); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-4, 3, 3, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4, 0, 3, 1.6, 0.6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'pulse':
      for (const [bx, by] of [[-5, 3], [0, -4], [5, 3]]) { ctx.beginPath(); ctx.roundRect(bx - 1.5, by - 4, 3, 8, 1.5); ctx.fill(); }
      break;
    case 'beam':
      ctx.globalAlpha = 0.35; ctx.fillRect(-4, -9, 8, 18);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -9, 3, 18);
      break;
    case 'shield':
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, -5); ctx.lineTo(7, 0);
      ctx.quadraticCurveTo(6, 6, 0, 9); ctx.quadraticCurveTo(-6, 6, -7, 0); ctx.lineTo(-7, -5); ctx.closePath();
      ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
      break;
    case 'slow': // hourglass
      ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(5, -8); ctx.lineTo(-5, 8); ctx.lineTo(5, 8); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(3, 7); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
      break;
    case 'time': // clock
      ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 0); ctx.lineTo(4, 2); ctx.stroke();
      break;
    case 'haste': // lightning bolt
      ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(-6, 1); ctx.lineTo(-1, 1); ctx.lineTo(-3, 10); ctx.lineTo(6, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill();
      break;
    case 'stub': // a short arrow under a bar
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3.5, 1); ctx.lineTo(0, -5); ctx.lineTo(3.5, 1); ctx.closePath(); ctx.fill();
      break;
    case 'sword':
      ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(6, -8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(-1, 6); ctx.stroke();
      break;
    case 'side':
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(3, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(9, 0); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill();
      break;
    case 'rocket':
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-4.5, 2); ctx.lineTo(4.5, 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3, 5); ctx.lineTo(0, 9); ctx.lineTo(3, 5); ctx.stroke();
      break;
    case 'lance':
      ctx.fillRect(-1, -9, 2, 18);
      ctx.globalAlpha = 0.35; ctx.fillRect(-3, -9, 6, 18); ctx.globalAlpha = 1;
      break;
    case 'master': // a loop of rope
      ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, 3); ctx.lineTo(-6, 9); ctx.moveTo(3, 3); ctx.lineTo(6, 9); ctx.stroke();
      break;
    case 'life': // heart
      ctx.beginPath(); ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-12, 0, -7, -9, 0, -3);
      ctx.bezierCurveTo(7, -9, 12, 0, 0, 8); ctx.fill();
      break;
  }
  ctx.restore();
}

function overlay(ctx: CanvasRenderingContext2D, title: string, col: string, sub: string) {
  ctx.fillStyle = 'rgba(7,8,15,0.7)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, title, W / 2, 200, 56, col);
  text(ctx, sub, W / 2, 260, 16, '#cfd4ff', 'center', 400);
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.floor(v * 0.45);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function backdrop(ctx: CanvasRenderingContext2D, t: number) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  background(ctx);
  ctx.fillStyle = '#1a1236';
  ctx.fillRect(0, H, W, 60);
  for (let i = 0; i < 6; i++) {
    const r = RADII[i], x = ((t * (20 + i * 9) + i * 170) % (W + 200)) - 100;
    const y = 400 - Math.abs(Math.sin(t * (1.6 - i * 0.15) + i)) * (90 + i * 30) - r;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = BALL_COL[i];
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Menu layout (view coordinates): the six rows (Play, Mode, Players, Settings, Stats, Drops), all on the centre line. */
export const MENU_Y = { rows: [226, 282, 320, 384, 416, 448], hint: 348, played: 478 };

export interface MenuView {
  /** The chosen mode needs more players than the chosen way of playing gives. */
  blocked: boolean;
  row: number; t: number; gameMode: { id: Mode; name: string; hint: string }; playName: string;
  /** Lifetime seconds played, shown under the menu. */
  playSecs: number;
  /** Each keyboard player's keys, for the footer. */
  controls: string[];
  slogan: string }

export function drawMenu(ctx: CanvasRenderingContext2D, m: MenuView) {
  backdrop(ctx, m.t);
  const Y = MENU_Y;
  text(ctx, 'OVERPOPPED', W / 2, 110, 72, '#fff');
  text(ctx, m.slogan, W / 2, 162, 16, '#cfd4ff', 'center', 400);
  const sel = '#ffd43b';
  if (m.blocked) text(ctx, `${m.gameMode.name} needs 2+ players`, W / 2, Y.rows[0], 20, '#ff8787');
  else text(ctx, touch ? 'TAP TO PLAY' : 'PLAY', W / 2, Y.rows[0], 34, m.row === 0 ? sel : '#8ce99a');
  // Mode and Players: each value on the centre line, with its arrows either side
  [m.gameMode.name, m.playName].forEach((v, i) => {
    const y = Y.rows[1 + i], on = m.row === 1 + i, col = on ? sel : '#8a90c7';
    text(ctx, v, W / 2, y, 20, col);
    const half = ctx.measureText(v).width / 2 + 22;
    text(ctx, '<', W / 2 - half, y, 20, col);
    text(ctx, '>', W / 2 + half, y, 20, col);
  });
  const hint = m.gameMode.id === 'classic' ? '' : m.gameMode.hint;
  if (hint) text(ctx, hint, W / 2, Y.hint, 13, '#8a90c7', 'center', 400);
  ['Settings', 'Stats', 'Drops'].forEach((k, i) => text(ctx, k, W / 2, Y.rows[3 + i], 20, m.row === 3 + i ? sel : '#8a90c7'));
  if (m.playSecs >= 60) text(ctx, `${longTime(m.playSecs)} played`, W / 2, Y.played, 13, '#5b6090', 'center', 400);
  text(ctx, touch ? 'Tap a row to change it' : `P1: ${m.controls[0]}      P2: ${m.controls[1]}      P: pause   Esc: menu`, W / 2, H + 30, 14, '#8a90c7', 'center', 400);
}

/** Settings layout (view coordinates), shared with the touch handling. */
export const SET_UI = { volY: 100, musicY: 140, menuY: 180, label: 300, sliderX: 340, sliderW: 360, headY: 232, rowY: 272, rowGap: 44, colX: [450, 680], cellW: 190, cellH: 34, resetY: 418 };

export interface SettingsView {
  t: number;
  /** Sound effects and music volume, 0..volMax */
  vol: number; music: number; volMax: number;
  /** Music on the screens outside a game. */
  menuMusic: boolean;
  /** keys[player][action] as display names, '' for none. */
  keys: string[][];
  /** 0 sound effects, 1 music, 2 menu music, 3-5 left/right/fire, 6 reset. */
  row: number; col: number;
  /** Waiting for a key for the selected cell. */
  capture: boolean;
}

export function drawSettings(ctx: CanvasRenderingContext2D, v: SettingsView) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const U = SET_UI, sel = (r: number) => v.row === r;
  text(ctx, 'SETTINGS', 40, 50, 30, '#fff', 'left');

  // volume sliders
  ([['Sound effects', v.vol, U.volY], ['Music', v.music, U.musicY]] as const).forEach(([name, val, y], r) => {
    text(ctx, name, U.label, y, 18, sel(r) ? '#ffd43b' : '#8a90c7', 'right');
    const f = val / v.volMax, kx = U.sliderX + f * U.sliderW;
    ctx.fillStyle = '#2b2f55';
    ctx.beginPath(); ctx.roundRect(U.sliderX, y - 3, U.sliderW, 6, 3); ctx.fill();
    ctx.fillStyle = sel(r) ? '#ffd43b' : '#7d86d6';
    ctx.beginPath(); ctx.roundRect(U.sliderX, y - 3, Math.max(6, f * U.sliderW), 6, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(kx, y, 11, 0, Math.PI * 2); ctx.fill();
    text(ctx, val === 0 ? 'Off' : `${Math.round(f * 100)}%`, U.sliderX + U.sliderW + 30, y, 16, '#e8eaf6', 'left');
  });

  text(ctx, 'Menu music', U.label, U.menuY, 18, sel(2) ? '#ffd43b' : '#8a90c7', 'right');
  text(ctx, v.menuMusic ? 'On' : 'Off', U.sliderX, U.menuY, 18, v.menuMusic ? (sel(2) ? '#ffd43b' : '#e8eaf6') : '#5b6090', 'left');

  // controls
  ['Player 1', 'Player 2 (same keyboard)'].forEach((k, c) => text(ctx, k, U.colX[c], U.headY, 14, PLAYER_COL[c], 'center', 600));
  ['Left', 'Right', 'Fire'].forEach((k, a) => {
    const y = U.rowY + a * U.rowGap;
    text(ctx, k, U.label, y, 18, sel(a + 3) ? '#ffd43b' : '#8a90c7', 'right');
    for (let c = 0; c < 2; c++) {
      const on = sel(a + 3) && v.col === c, x = U.colX[c] - U.cellW / 2;
      ctx.fillStyle = on ? '#1b1e3d' : '#10122a';
      ctx.fillRect(x, y - U.cellH / 2, U.cellW, U.cellH);
      ctx.strokeStyle = on ? '#ffd43b' : '#2b2f55';
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(x, y - U.cellH / 2, U.cellW, U.cellH);
      if (on && v.capture) {
        if (Math.floor(v.t * 3) % 2 === 0) text(ctx, 'press a key', U.colX[c], y + 1, 15, '#ffd43b', 'center', 600);
      } else text(ctx, v.keys[c][a] || '-', U.colX[c], y + 1, 16, v.keys[c][a] ? '#e8eaf6' : '#5b6090', 'center', 600);
    }
  });
  text(ctx, 'Reset controls', W / 2, U.resetY, 16, sel(6) ? '#ffd43b' : '#8a90c7');

  if (touch) closeButton(ctx);
  else text(ctx, v.capture ? 'Press a key for it   Esc: cancel' : v.row <= 1 ? '< >: volume   Esc: back' : v.row === 2 ? 'Enter: on / off   Esc: back' : v.row === 6 ? 'Enter: reset   Esc: back' : 'Enter: change key   Esc: back', W / 2, H + 44, 13, '#8a90c7', 'center', 400);
}

export interface StatsView {
  life: Lifetime;
  /** Floor names, or '' for floors not reached yet. */
  floors: string[];
  /** How far the list on the left is scrolled, in px. */
  scroll: number;
}

/** Stats layout: the scrolling list on the left (view coordinates). */
export const STATS_UI = { x0: 40, x1: 440, top: 118, bottom: 486, rowH: 40, split: 470 };

/** Lifetime numbers in a scrolling list on the left, fastest clear of each floor on the right. Returns the scroll, kept in range. */
export function drawStats(ctx: CanvasRenderingContext2D, v: StatsView): number {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const L = v.life, U = STATS_UI;
  text(ctx, 'STATS', 40, 50, 30, '#fff', 'left');
  const acc = L.shots >= 10 ? `${Math.round((100 * L.pops) / L.shots)}%` : '-';
  const rows: [string, string][] = [
    ['Time played', L.playSecs >= 60 ? longTime(L.playSecs) : clock(L.playSecs)],
    ['Games', String(L.games)],
    ['Online games', String(L.onlineGames)],
    ['Bubbles popped', L.pops.toLocaleString()],
    ['Shots fired', L.shots.toLocaleString()],
    ['Accuracy', acc],
    ['Deaths', L.deaths.toLocaleString()],
    ['Drops picked up', L.picks.toLocaleString()],
    ['Levels cleared', String(L.levelsCleared)],
    ['Floors cleared', String(L.floorsCleared)],
    ['Best climb from the ground', !L.bestClimb ? '-' : L.bestClimb > FLOORS.length ? 'The top' : `Floor ${L.bestClimb}`],
  ];
  const view = U.bottom - U.top, max = Math.max(0, rows.length * U.rowH - view);
  const scroll = Math.max(0, Math.min(max, v.scroll));

  text(ctx, 'LIFETIME', U.x0, 100, 12, '#ffa94d', 'left');
  ctx.save();
  ctx.beginPath(); ctx.rect(0, U.top, U.split, view); ctx.clip();
  rows.forEach(([k, val], i) => {
    const y = U.top + i * U.rowH - scroll + U.rowH / 2;
    if (y < U.top - U.rowH || y > U.bottom + U.rowH) return;
    text(ctx, k, U.x0, y, 16, '#8a90c7', 'left', 600);
    text(ctx, val, U.x1, y, 18, '#fff', 'right');
    ctx.fillStyle = '#1a1d3a';
    ctx.fillRect(U.x0, y + U.rowH / 2 - 1, U.x1 - U.x0, 1);
  });
  ctx.restore();
  if (max > 0) {
    // fades where the list goes on, and a thin scrollbar
    const fade = (y: number, up: boolean) => {
      const g = ctx.createLinearGradient(0, y, 0, up ? y + 28 : y - 28);
      g.addColorStop(0, '#07080f'); g.addColorStop(1, 'rgba(7,8,15,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, up ? y : y - 28, U.split, 28);
    };
    if (scroll > 0) fade(U.top, true);
    if (scroll < max) fade(U.bottom, false);
    const h = (view * view) / (view + max), y = U.top + ((view - h) * scroll) / max;
    ctx.fillStyle = '#2b2f55';
    ctx.beginPath(); ctx.roundRect(U.x1 + 14, y, 4, h, 2); ctx.fill();
  }
  ctx.fillStyle = '#1a1d3a';
  ctx.fillRect(U.split, 84, 1, U.bottom - 84);

  const X = 500;
  text(ctx, 'FASTEST FLOORS', X, 100, 12, '#ffa94d', 'left');
  v.floors.forEach((name, i) => {
    const y = 132 + i * 36, best = L.bestFloor[i];
    text(ctx, String(i + 1), X, y, 16, name ? '#8a90c7' : '#5b6090', 'left');
    text(ctx, name || '? ? ?', X + 30, y, 15, name ? '#e8eaf6' : '#5b6090', 'left', 600);
    text(ctx, best ? clock(best) + '.' + Math.round((best % 1) * 10) : '-', W - 40, y - (best ? 6 : 0), best ? 17 : 15, best ? '#ffd43b' : '#5b6090', 'right');
    if (best && L.bestFloorBy[i]) text(ctx, L.bestFloorBy[i], W - 40, y + 11, 10, '#8a90c7', 'right', 400);
  });
  if (touch) closeButton(ctx);
  else text(ctx, max > 0 ? 'Up/Down or wheel: scroll   Esc: back' : 'Esc: back', W / 2, H + 44, 13, '#8a90c7', 'center', 400);
  return scroll;
}

/** Layout of the tower screen (view coordinates), shared with the touch handling. */
export const TOWER_UI = { top: 76, slabH: 40, gap: 5, cx: 236, w: 400, listX: 520, listY: 176, listGap: 31, goY: 470 };

export interface TowerView {
  t: number;
  /** Top floor last. `levels` holds names, or '' for a level not seen yet. */
  floors: { name: string; locked: boolean; levels: string[] }[];
  floor: number; // selected floor
  level: number; // selected level on it; 0 = climb from the checkpoint, anything else is practice
  /** Developer picker on: every level open, nothing saved. */
  dev?: boolean;
}

/** The tower itself: one slab per floor, top floor at the top. `marks` puts a player-coloured pip on the floor each player has reached. */
function drawSlabs(ctx: CanvasRenderingContext2D, floors: TowerView['floors'], sel: number, marks: number[] = []) {
  const U = TOWER_UI, n = floors.length;
  floors.forEach((f, i) => {
    const w = U.w * (1 - i * 0.04), x = U.cx - w / 2, y = U.top + (n - 1 - i) * (U.slabH + U.gap);
    const on = i === sel;
    ctx.fillStyle = f.locked ? '#0b0c18' : '#1b1e3d';
    ctx.fillRect(x, y, w, U.slabH);
    ctx.lineWidth = 2;
    ctx.strokeStyle = on ? '#ffa94d' : f.locked ? '#1e2140' : '#7d86d6';
    ctx.strokeRect(x, y, w, U.slabH);
    const col = f.locked ? '#5b6090' : '#e8eaf6';
    text(ctx, String(i + 1), x + 16, y + U.slabH / 2 + 1, 20, col, 'left');
    text(ctx, f.locked ? '? ? ?' : f.name, x + 48, y + U.slabH / 2 + 1, 15, col, 'left', 600);
    if (f.locked) {
      // padlock
      const lx = x + w - 24, ly = y + U.slabH / 2;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(lx - 5, ly - 1, 10, 7);
      ctx.beginPath(); ctx.arc(lx, ly - 1, 3, Math.PI, 0); ctx.stroke();
    } else {
      f.levels.forEach((name, k) => {
        const px = x + w - 16 - (f.levels.length - 1 - k) * 11;
        ctx.beginPath(); ctx.arc(px, y + U.slabH / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = '#7d86d6'; ctx.lineWidth = 1;
        if (name) ctx.fill(); else ctx.stroke();
      });
    }
    // players who have reached this floor, as small figures hanging off the slab's left edge
    let m = 0;
    marks.forEach((r, p) => {
      if (r !== i) return;
      ctx.fillStyle = PLAYER_COL[p % PLAYER_COL.length];
      const px = x - 8 - m++ * 8, py = y + U.slabH / 2;
      ctx.beginPath(); ctx.arc(px, py - 6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(px - 3, py - 2, 6, 10);
    });
  });
  ctx.fillStyle = '#2b2f55';
  ctx.fillRect(U.cx - U.w / 2 - 12, U.top + n * (U.slabH + U.gap), U.w + 24, 4);
}

export function drawTower(ctx: CanvasRenderingContext2D, v: TowerView) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const U = TOWER_UI;
  text(ctx, 'THE TOWER', U.cx - U.w / 2, 50, 30, '#fff', 'left');
  drawSlabs(ctx, v.floors, v.floor);

  const f = v.floors[v.floor];
  text(ctx, `FLOOR ${v.floor + 1}`, U.listX, 100, 13, '#ffa94d', 'left');
  text(ctx, f.name, U.listX, 132, 30, '#fff', 'left');
  f.levels.forEach((name, k) => {
    const y = U.listY + k * U.listGap, on = k === v.level;
    text(ctx, String(k + 1), U.listX, y, 15, '#8a90c7', 'left', 400);
    text(ctx, name || '? ? ?', U.listX + 28, y, 17, on ? '#ffd43b' : name ? '#e8eaf6' : '#5b6090', 'left', on ? 700 : 400);
  });
  if (v.dev) text(ctx, 'DEV: all levels open, nothing saved', U.cx - U.w / 2, 16, 12, '#ff6b6b', 'left', 700);
  const go = v.level ? 'practice' : 'climb';
  text(ctx, touch ? `TAP HERE TO ${go.toUpperCase()}` : `Enter: ${go}`, U.listX, U.goY, 22, '#8ce99a', 'left');
  if (touch) closeButton(ctx);
  else text(ctx, 'Up/Down: floor   Left/Right: level   Esc: back', W / 2, H + 44, 13, '#8a90c7', 'center', 400);
}

export interface LobbyView {
  role: 'host' | 'guest'; status: string; code: string; typed: string; msg: string;
  /** Who is in the room, e.g. "3 of 4 players in the room". */
  room: string;
  modeName: string;
  modeHint: string;
  link: string; copied: boolean; t: number;
  /** The floor the host has picked, and the floor each player in the room has reached (seat order). */
  floor: number; reached: number[];
  /** The tower as this player sees it, with floors above the lowest player's locked. */
  floors: TowerView['floors'];
  /** Host: which settings row is selected. */
  row: number;
  starting: boolean;
}

/** Vertical positions of the lobby's tappable lines (view coordinates). The room's settings sit right of the tower. */
export const LOBBY_Y = { link: 107, floor: 158, mode: 392, start: 474 };

/** Splits `s` into lines no wider than `w` at the current font. */
function wrap(ctx: CanvasRenderingContext2D, s: string, size: number, w: number): string[] {
  ctx.font = `400 ${size}px ui-monospace, Menlo, Consolas, monospace`;
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(t).width > w) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function drawLobby(ctx: CanvasRenderingContext2D, v: LobbyView) {
  const dots = '.'.repeat(1 + (Math.floor(v.t * 2) % 3));
  const host = v.role === 'host';
  const inRoom = host ? v.status === 'waiting' || v.status === 'connected' : v.status === 'connected';
  if (inRoom) { drawRoom(ctx, v, dots); return; }

  backdrop(ctx, v.t);
  const sub = (s: string, y: number, c = '#cfd4ff') => text(ctx, s, W / 2, y, 16, c, 'center', 400);
  text(ctx, host ? 'HOST A GAME' : 'JOIN A GAME', W / 2, 62, 36);
  let foot = 'Esc: back', action = '';
  if (v.status === 'error') {
    text(ctx, v.msg, W / 2, 220, 20, '#ff6b6b');
    foot = 'Enter: try again   Esc: back';
    action = 'Tap to try again';
  } else if (host) sub(`Opening a room${dots}`, 220);
  else if (v.status === 'enter') {
    sub('Type the room code', 150);
    text(ctx, (v.typed + '____').slice(0, 4).split('').join(' '), W / 2, 215, 64, '#ffd43b');
    foot = v.typed.length === 4 ? 'Enter: connect   Esc: back' : 'Esc: back';
    action = 'Tap to type the code';
  } else sub(`Connecting to room ${v.code}${dots}`, 220);
  if (touch) {
    text(ctx, action, W / 2, 446, 24, '#8ce99a');
    closeButton(ctx);
  } else text(ctx, foot, W / 2, H + 30, 14, '#8a90c7', 'center', 400);
}

/** Inside a room: the shared tower on the left, the room and its settings on the right. */
function drawRoom(ctx: CanvasRenderingContext2D, v: LobbyView, dots: string) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const U = TOWER_UI, X = U.listX, host = v.role === 'host', versus = v.modeName === 'Versus';
  text(ctx, 'THE TOWER', U.cx - U.w / 2, 50, 30, '#fff', 'left');
  if (versus) ctx.globalAlpha = 0.3; // versus makes its own arenas
  drawSlabs(ctx, v.floors, v.floor, v.reached);
  ctx.globalAlpha = 1;

  text(ctx, 'ROOM', X, 40, 13, '#8a90c7', 'left');
  text(ctx, v.code.split('').join(' '), X + 52, 42, 30, '#ffd43b', 'left');
  if (host) {
    text(ctx, v.link, X, LOBBY_Y.link - 10, 11, '#8a90c7', 'left', 400);
    text(ctx, v.copied ? 'Invite link copied.' : touch ? 'Tap here to share the invite link' : 'C: copy invite link', X, LOBBY_Y.link + 8, 13, v.copied ? '#8ce99a' : '#cfd4ff', 'left', 400);
  }

  const edit = host && !v.starting;
  const row = (label: string, y: number, on: boolean) => text(ctx, edit ? `<  ${label}  >` : label, X, y, 20, on ? '#ffd43b' : '#8a90c7', 'left');
  if (!versus) {
    const f = v.floors[v.floor];
    row(`Floor ${v.floor + 1}`, LOBBY_Y.floor, edit && v.row === 0);
    text(ctx, f.name, X, LOBBY_Y.floor + 30, 22, '#fff', 'left');
    f.levels.forEach((name, k) => {
      const y = LOBBY_Y.floor + 58 + k * 20;
      text(ctx, String(k + 1), X, y, 12, '#8a90c7', 'left', 400);
      text(ctx, name || '? ? ?', X + 22, y, 14, name ? '#e8eaf6' : '#5b6090', 'left', 400);
    });
  }
  row(v.modeName, LOBBY_Y.mode, edit && v.row === 1);
  if (v.modeName !== 'Classic') wrap(ctx, v.modeHint, 12, W - X - 24).slice(0, 2).forEach((l, i) => text(ctx, l, X, LOBBY_Y.mode + 22 + i * 15, 12, '#8a90c7', 'left', 400));

  let foot = 'Esc: leave', action = '';
  if (host && v.status === 'connected') {
    text(ctx, v.starting ? `Starting${dots}` : v.room, X, 450, 14, '#8ce99a', 'left', 400);
    foot = 'Up/Down: setting   Left/Right: change   Enter: start   Esc: close room';
    action = v.starting ? '' : 'TAP HERE TO START';
  } else if (host) {
    text(ctx, `Waiting for friends to join${dots}`, X, 450, 14, '#cfd4ff', 'left', 400);
    foot = 'Up/Down: setting   Left/Right: change   Esc: close room';
  } else {
    text(ctx, v.room || 'Connected', X, 450, 14, '#8ce99a', 'left', 400);
    text(ctx, `Waiting for the host to start${dots}`, X, LOBBY_Y.start, 16, '#cfd4ff', 'left', 400);
  }
  if (touch) {
    if (action) text(ctx, action, X, LOBBY_Y.start, 22, '#8ce99a', 'left');
    closeButton(ctx);
  } else text(ctx, foot, W / 2, H + 44, 13, '#8a90c7', 'center', 400);
}

const isFloorEnd = (L: Level) => { const f = FLOORS[L.floor! - 1]; return !!f && f.levels[f.levels.length - 1].name === L.name; };
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** End of a floor: the floor's slab fills with gold, the one above unlocks, confetti. Plays itself out; no choices. */
function drawFloorUp(ctx: CanvasRenderingContext2D, s: State, f: number) {
  const T = (FLOOR_UP_TICKS - s.phaseT) / 60; // seconds in
  const out = clamp01((s.phaseT - 0) / 25); // fade out over the last moments
  ctx.save();
  ctx.globalAlpha = Math.min(clamp01(T / 0.35), out);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, W, H);

  // confetti in the ball colours, falling from above
  for (let i = 0; i < 70; i++) {
    const r1 = Math.sin(i * 12.9898) * 43758.5453, r = r1 - Math.floor(r1);
    const r2 = Math.sin(i * 78.233) * 12345.678, q = r2 - Math.floor(r2);
    const r3 = Math.sin(i * 39.425) * 9876.54, z = r3 - Math.floor(r3);
    const t = T - 0.5;
    if (t < 0) continue;
    const x = r * W + Math.sin(t * 3 + i) * 18, y = -10 - z * 260 + t * (90 + q * 120);
    if (y > H) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (2 + q * 4) + i);
    ctx.fillStyle = BALL_COL[i % BALL_COL.length];
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }

  const floor = FLOORS[f], next = FLOORS[f + 1];
  const head = ease((T - 0.2) / 0.5);
  ctx.globalAlpha *= head;
  text(ctx, `FLOOR ${f + 1}`, W / 2, 62 - (1 - head) * 10, 15, '#ffa94d');
  text(ctx, floor.name.toUpperCase(), W / 2, 104 - (1 - head) * 10, 42, '#fff');
  ctx.globalAlpha /= head || 1;

  // the run's numbers for this floor
  const lo = FLOOR_START[f], hi = lo + floor.levels.length;
  let ticks = 0, deaths = 0;
  for (const [lv, lt, , lost] of s.hist) if (lv >= lo && lv < hi) { ticks += lt; deaths += lost; }
  const secs = Math.round(ticks / 60);
  const stats = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}   ·   ${deaths === 0 ? 'no deaths' : deaths === 1 ? '1 death' : `${deaths} deaths`}`;
  ctx.globalAlpha *= clamp01((T - 0.7) / 0.4);
  text(ctx, stats, W / 2, 142, 15, '#cfd4ff', 'center', 400);
  ctx.globalAlpha = Math.min(clamp01(T / 0.35), out);

  // three slabs: the floor below (dim), this floor (fills gold), the one above (unlocks)
  const sw = (k: number) => 440 * (1 - k * 0.04);
  const slab = (k: number, y: number, fill: number, label: string, locked: boolean, glow: number) => {
    const w = sw(k), x = W / 2 - w / 2, h = 46;
    ctx.fillStyle = locked ? '#0b0c18' : '#1b1e3d';
    ctx.fillRect(x, y, w, h);
    if (fill > 0) { ctx.fillStyle = '#ffd43b'; ctx.globalAlpha *= 0.9; ctx.fillRect(x, y, w * fill, h); ctx.globalAlpha /= 0.9; }
    if (glow > 0) { ctx.shadowColor = '#ffd43b'; ctx.shadowBlur = 24 * glow; }
    ctx.lineWidth = 2;
    ctx.strokeStyle = glow > 0 ? '#ffd43b' : locked ? '#1e2140' : '#7d86d6';
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
    const col = fill >= 1 ? '#1a1200' : locked ? '#5b6090' : '#e8eaf6';
    text(ctx, String(k + 1), x + 18, y + h / 2 + 1, 22, col, 'left');
    text(ctx, label, x + 52, y + h / 2 + 1, 16, col, 'left', 600);
    return { x, w, h };
  };
  const yThis = 300, yUp = yThis - 56, yDown = yThis + 56;
  if (f > 0) { ctx.globalAlpha *= 0.45; slab(f - 1, yDown, 1, FLOORS[f - 1].name, false, 0); ctx.globalAlpha /= 0.45; }
  slab(f, yThis, ease((T - 0.5) / 0.8), floor.name, false, 0);
  if (next) {
    const open = (T - 1.6) / 0.35; // padlock shakes, then springs open
    const reveal = clamp01((T - 2.0) / 0.6);
    const shown = next.name.slice(0, Math.round(next.name.length * reveal));
    const r = slab(f + 1, yUp, 0, reveal > 0 ? shown : '? ? ?', reveal <= 0, reveal > 0 ? 1 - clamp01((T - 3.2) / 1.2) : 0);
    if (open < 1.2) {
      const lx = r.x + r.w - 26, ly = yUp + r.h / 2;
      const shake = open < 0 && T > 1.2 ? Math.sin(T * 60) * 2 : 0;
      ctx.globalAlpha *= 1 - clamp01((open - 0.6) / 0.6);
      ctx.strokeStyle = open > 0 ? '#ffd43b' : '#5b6090';
      ctx.lineWidth = 2;
      ctx.strokeRect(lx - 7 + shake, ly - 1 - (open > 0 ? open * 10 : 0), 14, 10);
      ctx.beginPath();
      ctx.arc(lx + shake + (open > 0 ? 6 : 0), ly - 1 - (open > 0 ? open * 10 : 0) - (open > 0 ? 3 : 0), 4.5, Math.PI, 0);
      ctx.stroke();
      ctx.globalAlpha = Math.min(clamp01(T / 0.35), out);
    }
  } else {
    // the top of the tower
    const c = ease((T - 1.6) / 0.6);
    ctx.globalAlpha *= c;
    text(ctx, 'THE TOP', W / 2, yUp + 20, 28, '#ffd43b');
    ctx.globalAlpha /= c || 1;
  }
  ctx.restore();
}

/** Gun bearer (a harpoon held up, gold) or VIP (a crown) marker drawn over a player. */
function drawRole(ctx: CanvasRenderingContext2D, role: 'gun' | 'vip' | '', x: number, y: number, tick: number, scale = 1) {
  if (!role) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const bob = Math.sin(tick * 0.15) * 1.5;
  if (role === 'vip') {
    ctx.fillStyle = '#ffd43b';
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-11, -6 + bob); ctx.lineTo(-11, -17 + bob); ctx.lineTo(-5, -11 + bob); ctx.lineTo(0, -20 + bob);
    ctx.lineTo(5, -11 + bob); ctx.lineTo(11, -17 + bob); ctx.lineTo(11, -6 + bob); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.arc(0, -10 + bob, 2, 0, Math.PI * 2); ctx.fill();
  } else {
    // a gold harpoon held over the shoulder, with a glow so it reads at a glance
    ctx.shadowColor = '#ffd43b';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ffd43b';
    ctx.fillStyle = '#ffd43b';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(12, 30); ctx.lineTo(12, -12 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -8 + bob); ctx.lineTo(12, -20 + bob); ctx.lineTo(18, -8 + bob); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export interface ResultsView { s: State; you: number; levels: Level[]; online: boolean; t: number;
  /** Which award's (?) is being hovered or was tapped, or -1. */
  help: number;
  /** Where going back leads: 'lobby', 'tower' or 'menu'. */
  back: string;
  /** A short note after sharing ('copied', 'saved'), or ''. */
  note: string }

/** Height of the play again / back line on the results screen. */
export const RESULTS_BTN_Y = H + 20;

/** Where the award headings sit, for hovering/tapping their (?). */
export const AWARD_UI = { y: 372, gap: 280, halfW: 110 };
const AWARD_HELP = [
  'Time spent with a ball within 16 px of you without being hit.',
  'The nearest a ball came to you without hitting you, in pixels.',
  'Balls popped per shot fired. Needs 10 shots or more to count.',
];

/** End-of-game stats: one row per player, best in each column picked out. */
export function drawResults(ctx: CanvasRenderingContext2D, v: ResultsView) {
  backdrop(ctx, v.t);
  ctx.fillStyle = 'rgba(7,8,15,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const s = v.s, L = levelAt(s, v.levels);
  let [title, col] = s.phase === 'won' ? ['YOU WIN', '#ffd43b'] : s.phase === 'over' ? ['GAME OVER', '#ff6b6b'] : ['GAME ENDED', '#fff'];
  if (s.mode === 'versus') {
    const top = Math.max(...s.players.map((p) => (p.lives > 0 ? p.wins : -1)));
    const best = s.players.map((p, i) => (p.lives > 0 && p.wins === top ? i : -1)).filter((i) => i >= 0);
    if (s.phase === 'won' && best.length === 1) [title, col] = [`${COLOR_NAMES[best[0]].toUpperCase()} WINS`, PLAYER_COL[best[0]]];
  }
  text(ctx, title, W / 2, 56, 44, col);
  const mode = MODES.find((m) => m.id === s.mode)!.name;
  text(ctx, s.mode === 'versus' ? `${mode}  -  ${s.level + 1} rounds played` : `${mode}  -  reached level ${s.level + 1}/${v.levels.length} (${L?.name ?? ''})  -  team score ${s.score}`, W / 2, 98, 15, '#cfd4ff', 'center', 400);

  const time = (ticks: number) => { const sec = Math.round(ticks / 60); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  const cols: { h: string; get: (i: number) => number; show: (n: number) => string; low?: boolean }[] = [
    { h: 'Popped', get: (i) => s.players[i].st.pops, show: String },
    { h: 'Points', get: (i) => s.players[i].st.score, show: String },
    { h: 'Time alive', get: (i) => s.players[i].st.alive, show: time },
    { h: 'Lives lost', get: (i) => s.players[i].st.deaths, show: String, low: true },
    { h: 'Shots', get: (i) => s.players[i].st.shots, show: String },
    { h: 'Pickups', get: (i) => s.players[i].st.picks, show: String },
    ...(s.mode === 'versus' ? [{ h: 'Rounds won', get: (i: number) => s.players[i].wins, show: String }] : []),
    ...(s.mode === 'revive' ? [{ h: 'Revives', get: (i: number) => s.players[i].st.revives, show: String }] : []),
  ];
  const x0 = 170, dx = (W - x0 - 40) / cols.length, top = 150;
  cols.forEach((c, k) => text(ctx, c.h, x0 + dx * (k + 0.5), top, 14, '#8a90c7', 'center', 400));
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(40, top + 16, W - 80, 1);
  const n = s.players.length;
  for (let i = 0; i < n; i++) {
    const y = top + 48 + i * 46;
    if (i === v.you) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(40, y - 20, W - 80, 40); }
    const name = n === 1 ? 'You' : COLOR_NAMES[i][0].toUpperCase() + COLOR_NAMES[i].slice(1) + (i === v.you ? ' (you)' : '');
    text(ctx, name, 56, y, 18, PLAYER_COL[i % PLAYER_COL.length], 'left');
    cols.forEach((c, k) => {
      const vals = s.players.map((_, j) => c.get(j));
      const best = c.low ? Math.min(...vals) : Math.max(...vals);
      const top1 = n > 1 && vals[i] === best && vals.filter((x) => x === best).length < n;
      text(ctx, c.show(vals[i]), x0 + dx * (k + 0.5), y, 18, top1 ? '#ffd43b' : '#fff', 'center', top1 ? 700 : 400);
    });
  }
  // awards: every player's figure, best first
  const P = s.players, short = (i: number) => (n === 1 ? 'You' : COLOR_NAMES[i][0].toUpperCase() + COLOR_NAMES[i].slice(1));
  const acc = (i: number) => (P[i].st.shots >= 10 ? P[i].st.pops / P[i].st.shots : -1);
  const awards: { h: string; get: (i: number) => number; show: (x: number) => string; low?: boolean }[] = [
    { h: 'Most reckless', get: (i) => P[i].st.danger, show: (x) => `${(x / 60).toFixed(1)} s` },
    { h: 'Closest shave', get: (i) => P[i].st.shave, show: (x) => (x < 16 ? `${x.toFixed(1)} px` : '-'), low: true },
    { h: 'Sharpshooter', get: (i) => acc(i), show: (x) => (x < 0 ? '-' : `${Math.round(x * 100)}%`) },
  ];
  awards.forEach((a, k) => {
    const x = W / 2 + (k - 1) * AWARD_UI.gap, Y = AWARD_UI.y;
    text(ctx, a.h.toUpperCase(), x - 9, Y, 12, '#8a90c7');
    ctx.font = '700 12px ui-monospace, Menlo, Consolas, monospace';
    const qx = x - 9 + ctx.measureText(a.h.toUpperCase()).width / 2 + 12;
    ctx.strokeStyle = v.help === k ? '#ffd43b' : '#5b6090';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(qx, Y, 7, 0, Math.PI * 2); ctx.stroke();
    text(ctx, '?', qx, Y + 1, 10, v.help === k ? '#ffd43b' : '#8a90c7');
    const order = P.map((_, i) => i).sort((i, j) => (a.low ? a.get(i) - a.get(j) : a.get(j) - a.get(i)) || i - j);
    order.forEach((i, r) => {
      const y = 394 + r * 20;
      text(ctx, short(i), x - 8, y, r === 0 ? 16 : 14, PLAYER_COL[i % PLAYER_COL.length], 'right', r === 0 ? 700 : 400);
      text(ctx, a.show(a.get(i)), x + 8, y, r === 0 ? 16 : 14, r === 0 ? '#fff' : '#cfd4ff', 'left', r === 0 ? 700 : 400);
    });
  });
  if (v.help >= 0) {
    const lines = wrap(ctx, AWARD_HELP[v.help], 13, 260);
    const bw = 284, bh = 18 + lines.length * 18, bx = Math.max(8, Math.min(W - bw - 8, W / 2 + (v.help - 1) * AWARD_UI.gap - bw / 2)), by = AWARD_UI.y - 16 - bh;
    ctx.fillStyle = '#1b1e3d';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#7d86d6';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    lines.forEach((l, i) => text(ctx, l, bx + 12, by + 18 + i * 18, 13, '#e8eaf6', 'left', 400));
  }
  resultsActions(v.online, v.back).forEach((a, k, all) => {
    const x = (W * (k + 0.5)) / all.length, col = a.id === 'again' || a.id === 'back' && v.online ? '#8ce99a' : '#cfd4ff';
    text(ctx, touch ? a.label.toUpperCase() : `${a.key}: ${a.label}`, x, RESULTS_BTN_Y, touch ? 20 : 15, col);
  });
  if (v.note) text(ctx, v.note, W / 2, RESULTS_BTN_Y + 26, 13, '#ffd43b', 'center', 400);
}

/** The actions along the bottom of the results screen, left to right (each gets an equal share of the width). */
export function resultsActions(online: boolean, back: string): { id: 'again' | 'moments' | 'share' | 'back'; key: string; label: string }[] {
  const where = back === 'tower' ? 'choose floor' : back === 'lobby' ? 'lobby' : 'menu';
  return [
    ...(online ? [] : [{ id: 'again' as const, key: 'Enter', label: 'play again' }]),
    { id: 'moments', key: 'M', label: 'top moments' },
    { id: 'share', key: 'C', label: 'share' },
    { id: 'back', key: online ? 'Enter' : 'Esc', label: where },
  ];
}

/** The drops page: every kind of drop, the ones never picked up still hidden. */
export function drawDrops(ctx: CanvasRenderingContext2D, v: { t: number; kinds: PickupKind[]; found: string[] }) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'DROPS', 40, 50, 30, '#fff', 'left');
  const got = v.kinds.filter((k) => v.found.includes(k)).length;
  text(ctx, `${got} / ${v.kinds.length}`, W - 40, 50, 20, got === v.kinds.length ? '#ffd43b' : '#8a90c7', 'right');
  // ten weapons in two rows, then the six other drops
  const weapons = v.kinds.slice(0, 10), items = v.kinds.slice(10);
  const rows: [PickupKind[], number][] = [[weapons.slice(0, 5), 150], [weapons.slice(5), 256], [items, 402]];
  text(ctx, 'WEAPONS', 40, 98, 12, '#ffa94d', 'left');
  text(ctx, 'OTHERS', 40, 346, 12, '#ffa94d', 'left');
  let n = 0;
  for (const [kinds, y] of rows) {
    kinds.forEach((k, i) => {
      const x = 40 + ((W - 80) * (i + 0.5)) / kinds.length, has = v.found.includes(k);
      if (has) {
        drawToken(ctx, k, x, y + Math.sin(v.t * 2 + n) * 2, 26);
        text(ctx, PICK[k].name, x, y + 46, 14, '#e8eaf6', 'center', 600);
      } else {
        ctx.fillStyle = '#10122a';
        ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2b2f55';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        text(ctx, '?', x, y + 1, 20, '#2b2f55');
        text(ctx, '? ? ?', x, y + 46, 14, '#3b4070', 'center', 600);
      }
      n++;
    });
  }
  if (touch) closeButton(ctx);
  else text(ctx, 'Esc: back', W / 2, H + 44, 13, '#8a90c7', 'center', 400);
}

/** Top moments: three small looping replays side by side. */
export const MOMENTS_UI = { y: 120, w: 280, h: 158, gap: 24 };
export const momentX = (k: number) => W / 2 + (k - 1) * (MOMENTS_UI.w + MOMENTS_UI.gap);

export function drawMoments(ctx: CanvasRenderingContext2D, v: { t: number; sel: number; thumbs: CanvasImageSource[]; labels: string[] }) {
  backdrop(ctx, v.t);
  ctx.fillStyle = 'rgba(7,8,15,0.75)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'TOP MOMENTS', 40, 50, 30, '#fff', 'left');
  const U = MOMENTS_UI;
  if (!v.thumbs.length) text(ctx, 'Too calm.', W / 2, U.y + U.h / 2, 20, '#5b6090');
  v.thumbs.forEach((img, k) => {
    const x = momentX(k) - U.w / 2, on = k === v.sel;
    ctx.drawImage(img, x, U.y, U.w, U.h);
    ctx.strokeStyle = on ? '#ffd43b' : '#2b2f55';
    ctx.lineWidth = on ? 3 : 1;
    ctx.strokeRect(x, U.y, U.w, U.h);
    text(ctx, `#${k + 1}`, x, U.y + U.h + 24, 18, on ? '#ffd43b' : '#8a90c7', 'left');
    text(ctx, v.labels[k], x + 40, U.y + U.h + 24, 14, on ? '#fff' : '#cfd4ff', 'left', 600);
  });
  if (touch) { closeButton(ctx); if (v.thumbs.length) text(ctx, 'TAP ONE TO WATCH', W / 2, 420, 18, '#8ce99a'); }
  else text(ctx, v.thumbs.length ? '< >: pick   Enter: watch   Esc: back' : 'Esc: back', W / 2, H + 44, 13, '#8a90c7', 'center', 400);
}

/** Over a full-size replay: a REPLAY tag, and saving it as a GIF. `gif`: progress 0..1 while one is being made, else -1. */
export const REPLAY_GIF_BTN = { x: W / 2, y: 20, halfW: 120 };
export function drawReplayBar(ctx: CanvasRenderingContext2D, v: { t: number; gif: number; note: string }) {
  ctx.fillStyle = 'rgba(7,8,15,0.45)';
  ctx.fillRect(0, 0, W, 40);
  if (Math.floor(v.t * 2) % 2 === 0) { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(28, 20, 6, 0, Math.PI * 2); ctx.fill(); }
  text(ctx, 'REPLAY', 42, 20, 16, '#fff', 'left');
  const label = v.gif >= 0 ? `making GIF ${Math.round(v.gif * 100)}%` : v.note || (touch ? 'SAVE GIF' : 'G: save GIF');
  text(ctx, label, REPLAY_GIF_BTN.x, REPLAY_GIF_BTN.y, 16, v.gif >= 0 ? '#ffd43b' : '#8ce99a');
  if (touch) closeButton(ctx);
  else text(ctx, 'Esc: back', W - 24, 20, 14, '#8a90c7', 'right', 400);
}

/** The picture to share after a game: drawn in view coordinates (VIEW_W x VIEW_H); scale the context for a bigger image. */
export function drawShareCard(ctx: CanvasRenderingContext2D, v: { s: State; levels: Level[]; you: number; url: string }) {
  backdrop(ctx, 7.3);
  ctx.fillStyle = 'rgba(7,8,15,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const s = v.s, L = levelAt(s, v.levels), P = s.players, n = P.length;
  const mode = MODES.find((m) => m.id === s.mode)!.name;
  text(ctx, 'OVERPOPPED', 40, 44, 26, '#fff', 'left');
  text(ctx, `${n === 1 ? 'Solo' : `${n} players`}${s.mode === 'classic' ? '' : ` · ${mode}`}`, W - 40, 44, 16, '#cfd4ff', 'right', 600);

  let [title, col] = s.phase === 'won' ? ['YOU WIN', '#ffd43b'] : ['GAME OVER', '#ff6b6b'];
  if (s.mode === 'versus') {
    const top = Math.max(...P.map((p) => p.wins)), best = P.map((p, i) => (p.wins === top ? i : -1)).filter((i) => i >= 0);
    if (best.length === 1) [title, col] = [`${COLOR_NAMES[best[0]].toUpperCase()} WINS`, PLAYER_COL[best[0]]];
  }
  text(ctx, title, W / 2, 124, 60, col);
  const floor = L?.floor ? FLOORS[L.floor - 1] : null;
  const where = s.mode === 'versus' ? `${s.level + 1} rounds`
    : floor ? `Floor ${L.floor} · ${floor.name}   ·   Level ${s.level - FLOOR_START[L.floor! - 1] + 1}: ${L.name}`
    : `Level ${s.level + 1}: ${L?.name ?? ''}`;
  text(ctx, where, W / 2, 178, 18, '#e8eaf6', 'center', 600);

  // four big numbers for the whole team
  const sum = (f: (i: number) => number) => P.reduce((a, _, i) => a + f(i), 0);
  const pops = sum((i) => P[i].st.pops), shots = sum((i) => P[i].st.shots);
  const ticks = s.hist.reduce((a, h) => a + h[1], 0);
  const tiles: [string, string][] = [
    ['POPPED', pops.toLocaleString()],
    ['ACCURACY', shots >= 10 ? `${Math.round((100 * pops) / shots)}%` : '-'],
    ['TIME', clock(ticks / 60)],
    ['SCORE', s.score.toLocaleString()],
  ];
  const tw = 196, tg = 20, tx0 = W / 2 - (tiles.length * tw + (tiles.length - 1) * tg) / 2;
  tiles.forEach(([k, val], i) => {
    const x = tx0 + i * (tw + tg);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.roundRect(x, 220, tw, 100, 12); ctx.fill();
    text(ctx, k, x + tw / 2, 246, 13, '#8a90c7');
    text(ctx, val, x + tw / 2, 288, 36, '#fff');
  });

  // the three awards, with who took each when there's more than one player
  const acc = (i: number) => (P[i].st.shots >= 10 ? P[i].st.pops / P[i].st.shots : -1);
  const awards: [string, (i: number) => number, (x: number) => string, boolean][] = [
    ['MOST RECKLESS', (i) => P[i].st.danger, (x) => `${(x / 60).toFixed(1)} s`, false],
    ['CLOSEST SHAVE', (i) => P[i].st.shave, (x) => (x < 16 ? `${x.toFixed(1)} px` : '-'), true],
    ['SHARPSHOOTER', acc, (x) => (x < 0 ? '-' : `${Math.round(x * 100)}%`), false],
  ];
  awards.forEach(([h, get, show, low], k) => {
    const x = W / 2 + (k - 1) * 290;
    const best = P.map((_, i) => i).sort((i, j) => (low ? get(i) - get(j) : get(j) - get(i)) || i - j)[0];
    text(ctx, h, x, 360, 13, '#ffa94d');
    text(ctx, show(get(best)), x, 392, 24, '#fff');
    if (n > 1) text(ctx, COLOR_NAMES[best][0].toUpperCase() + COLOR_NAMES[best].slice(1), x, 420, 14, PLAYER_COL[best % PLAYER_COL.length], 'center', 600);
  });

  ctx.fillStyle = '#1a1236';
  ctx.fillRect(0, H, W, 60);
  text(ctx, v.url, W / 2, H + 30, 18, '#8ce99a');
}
