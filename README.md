# Overpopped

A browser game about popping bouncing balls that split when you hit them. One to four
players, on one keyboard or online, peer to peer. It's a static site (GitHub Pages) plus
a tiny optional log collector on Cloudflare.

Live: https://jonsploder.github.io/bubble-trouble-online/

## Running it

```bash
npm install
npm run dev        # http://localhost:5173  (?play=tower-17 jumps straight to a level)
npm run build      # static site in dist/; pushing to main deploys it via GitHub Actions
```

Controls: arrows + Space (player 2 on one keyboard: A / D + W), Esc to pause. Both players' keys
can be changed under **Settings** on the menu, along with the sound effects and music volumes and whether the menu screens play music
(`src/settings.ts`, saved in the browser as `splitstorm.settings.v1`).
On a phone: left thumb slides to move, right thumb holds to fire.

## Game modes

Picked on the menu, or by the host in an online lobby.

| Mode | Rules |
|---|---|
| Classic | Everyone shoots. |
| One Gun | Roped together (see Tethered). Only one player, picked at random, can shoot; they carry a glowing gold harpoon. When they're hit, the gun passes to a random player who is still standing. |
| Protect the VIP | Roped together. One random player (wearing a crown) can't shoot. If the VIP is hit, everyone still standing loses a life and the attempt is over. |
| Versus | Each player gets their own lane (the level set is ignored; rounds are generated). When you pop a ball, its first piece stays and the rest drop into random rivals' lanes. Clear your lane first, or be the last one standing, to win the round. First to 3 rounds wins. |
| Tethered | Players are roped to their neighbours and can't get more than 170 px apart. In every roped mode a **rope master** pickup can drop: its holder drags neighbours along instead of being held back. |
| Two Heads | Players pair up in one body: one moves, the other shoots, and they swap every level. An odd player out plays alone. |
| Revive | The team shares 3 lives. A hit player waits in a small circle for 15 seconds; a teammate standing in it brings them back. That takes 1.5 s on the first fall of an attempt at a level and twice as long with each fall after it (3 s, 6 s, then 12 s from the fourth on). If time runs out, the whole team goes down and loses a life. Every player must be up for a level to count as cleared. |

Except in Revive, each player has their own 3 lives. A hit sits you out until the level is cleared or
restarts; the level restarts once everyone is down. Single-player games are always Classic.

## The Tower

All 58 levels are one climb of nine floors (`FLOORS` in `src/levels.ts`). Each floor opens on a new idea:

| Floor | Name | Levels |
|---|---|---|
| 1 | Ground Floor | 7: the basics |
| 2 | The Workshop | 8: Quickstep, then gates, drops, a descending roof |
| 3 | Portal Gallery | 5: portals, balls that bounce on the spot |
| 4 | Split Level | 7: balls that split into 3 and 4 (the number on a ball is how many pieces) |
| 5 | The Armoury | 6: odd weapons (below), and Every Shot Counts: a harpoon, vine or rocket that reaches the roof without hitting a ball costs a life (level flag `noMiss`; the roof glows red and is hung with skulls) |
| 6 | Heavy Weather | 7: armour, wind, gravity flips |
| 7 | Machine Room | 6: spin, moving blocks, crushers |
| 8 | Overclocked | 7: speed and cursed drops, and Photo Finish (outrun three balls to the far wall) |
| 9 | Summit | 5: Last Stand, Drum Line, then everything |

- A run starts at the first level of any unlocked floor with 3 lives each. Game over means starting that floor again.
- The floor picker opens on the highest floor reached. If you start lower, that floor is remembered until the page is reloaded (it isn't saved).
- A game ends with GAME OVER or YOU WIN for 2.5 s, then the results: **play again** (same start level, players and mode) or back to the floor picker. Online, results lead back to the lobby.
- Reaching a new floor unlocks it as a starting point and tops everyone's lives back up to 3.
- Progress is kept in the browser's local storage (`splitstorm.tower.v2`) as the name of the highest level reached, so adding levels never moves anyone's place (an old `v1` save, a level number, is converted once). Solo and online play share it.
- Lifetime stats (`splitstorm.stats.v1`, `src/stats.ts`): time played (shown on the menu), games, online games, bubbles popped, shots fired, accuracy, deaths, drops picked up, levels and floors cleared, the best climb from the ground (highest floor reached in one run started on the first level), and the fastest clear of each floor. A floor's time only counts if the run started on that floor's first level; it's the sum of every attempt on the floor, so deaths cost time. **Stats** on the menu (or **S**) opens the stats screen. Online, each player keeps their own.
- Finishing a floor plays a short ceremony (about 5 s, no choices): the floor fills gold, the next one unlocks and its name is revealed, with that floor's time and deaths for the run.
- The map shows names only for floors and levels already seen. A seen level can be picked directly for practice; practice runs save nothing.
- Online, the host can start no higher than the lowest floor anyone in the room has reached. Everyone playing saves what the run reaches.
- The game deliberately explains little. Level hints show only on the pause screen.
- Music (`src/music.ts`): each level plays the next track in the rotation (starting at a different point each game), a floor's last level plays a boss track, and tracks fade into each other. Retrying a level keeps its track. While testing, the top-left corner names the track playing and, online, shows the live ping to each other player.

Weapons beyond the harpoon, twin harpoon, sticky vine, pulse gun and beam:

| Weapon | What it does |
|---|---|
| Short harpoon | Reaches only 72 px above your head, rises at half a harpoon's speed, and fires at most once every 0.6 s. |
| Sword | A swipe 46 px in front of you, at body height. |
| Floor bolt | One bolt at a time along the floor, the way you face, picking up speed. Its tail (up to 180 px, longer the faster it goes) pops too. |
| Rocket | The same, straight up, and wide (18 px). Drops in ordinary levels too. |
| Lance | One thin 96 px bar of light at a time, travelling up. Drops in ordinary levels too. |

On the dev server, `?reach=20` opens the map as if level 20 had been reached, and `?play=tower-17` jumps into a level. Neither saves. On any build, pressing Backspace three times quickly on the menu or the tower picker opens every level for the session (marked DEV, saves no progress); the picker then stays on the floor and level last chosen.

The pause screen lists every mode's rules. The results screen ranks every player on three awards: **Most reckless** (time spent within 16 px of a ball), **Closest shave** (smallest gap to a ball that didn't hit you) and **Sharpshooter** (pops per shot).

The results screen also has:

- **Top moments** (M): the three tensest stretches of the game, picked by how close balls came to standing players. A clip runs 7 to 12 s, and one that ends in a hit shows at least 5 s of staying alive first (a quick death alone never counts). Each is replayed from a snapshot plus the recorded inputs (`src/highlights.ts`; online it records the confirmed frames). Pick one to watch it full size; **G** saves it as a 480×270 GIF (`gifenc`, loaded only when needed). Where the browser has a share sheet, a second press shares the GIF.
- **Share** (C): the results as a 1200×675 picture (`drawShareCard`) through the share sheet, else copied to the clipboard, else downloaded.

**Drops** on the menu shows every kind of drop; ones never picked up stay hidden. Picked-up kinds are kept in the lifetime stats (`drops`), from a bitmask each player carries through the game (`st.got`).

## How online play works

- **Finding each other.** The host's browser registers a 4-letter room code with the free
  public PeerJS broker. Guests ask the broker for that code, the browsers exchange
  connection details through it, and from then on they talk directly (WebRTC). No game
  server, no port forwarding. Guests connect to the host and to each other; if two guests
  can't reach each other directly, their inputs are passed along by the other players.
- **Rollback netcode** (`src/rollback.ts`). Only key presses are sent. Every browser runs
  the whole game itself; the game (`src/sim.ts`) is deterministic, so the same inputs give
  the same result everywhere. Your own presses apply after a short input delay; other
  players' presses are predicted and corrected when they arrive. Clocks are kept in step by
  running a few percent faster or slower, never by skipping frames, and the game only
  freezes after about a second of silence. Checksums catch any desync.

## Logs, stats and the report

When an online game ends, every player's browser uploads its own session log. At the end
of any game (online or not) player 1 uploads a record of each attempt at each level: how
long it lasted, whether it was cleared, failed or given up, and the lives lost. A game on
one computer (solo or two players) also includes its random seed and every key change, so
it can be replayed exactly; it uploads when the game ends and also if the page is closed or
reloaded mid-game. Both go to the Worker in `worker/` (Cloudflare free plan, Workers KV).
Each level record also carries an anonymous id made up by the browser on its first visit
(`splitstorm.player` in localStorage) and the seconds played in that game, so the report can
count unique players and time per player; online, the other players send a copy marked
`guest` that only counts towards that. Logs hold timings, key presses and packet arrival
times; no IP addresses or names. The dev
server never uploads.

```bash
npm run fetch-traces       # download new logs into traces/ and level stats into stats/levels/
npm run report             # build report/index.html (add -- --sweep to compare netcode settings)
npm run report:serve       # serve it at http://localhost:5299 with a Regenerate button (fetch + rebuild)
npm run replay             # replay every logged session through today's netcode, in the terminal
npm run solo               # replay the recorded one-computer games and check they reproduce
npm run replay -- --sweep  # same, trying alternative netcode settings
```

`fetch-traces` needs `.env.local` (not in git) containing `TRACE_READ_KEY=...`; the
collector's address comes from `.env`.

The report has two parts:

- **Online play**: per game version and player count, the link quality and what players
  actually experienced: time frozen, time slowed, and how often other players were drawn
  visibly in the wrong place (more than 8 px off). A final row replays every recorded
  session through today's netcode, which shows whether a change would have helped.
- **Level difficulty**: per level, the number of attempts, the share cleared, the share
  cleared first try, attempts per clear, median clear time, lives lost per clear, how
  often it was given up mid-level, and solo vs group. Solo, every life is its own attempt. Levels that
  are cleared first time in at least 90% of games are flagged "too easy?". Levels cleared on
  fewer than 20% of attempts are flagged "too hard?". Fewer than 5 attempts is "little data".

### Why replays stay useful

A session log records the *conditions*, not what the netcode did with them: when each
player's frames happened, what they were holding, and when each packet from each other
player arrived (or didn't). `scripts/tracelib.ts` rebuilds the real links from that,
aligning the players' clocks, and runs today's netcode over them. So old logs remain a
valid test for new netcode, and the library of logs grows into a regression suite. The
limit is that if the game rules or levels change, the replayed *game* plays out
differently, though the network conditions are still real.

### Tuning the netcode

The knobs are in `tuning` at the top of `src/rollback.ts`. A good loop:

1. `npm run fetch-traces && npm run replay -- --sweep` (or `npm run report -- --sweep`).
2. Change one knob, check `npm run nettest` (synthetic networks: loss, outages, 4 players,
   missing links) still passes, ship, and compare live numbers in the next report.

What the data has shown so far (Sydney–Japan, about 63 ms each way, under 1% loss):

| Change | Effect |
|---|---|
| Synchronised start and clock sync by speed (v5) | Freezes went from frequent to 0% |
| Input delay 2 → 3 frames (v6+) | Other player visibly off: 5.8% → 2.0% of frames (live) |
| Input delay 4 | Replays suggest about 0.7%, at the cost of another 17 ms on your own keys |
| Slowdown / clock-sync thresholds | Within a few percent either way; left alone |

Ideas not yet tried:

- **Adaptive input delay**: pick 2–4 frames per game from the measured ping in the lobby.
- **Smarter prediction**: predict "still holding fire" for less long, or predict a
  direction release after a typical hold length.
- **Render-side smoothing**: blend corrections over more frames for small errors and snap
  big ones; tune the 0.4 easing in `render.ts`.
- **Lobby room**: refuse or warn when one player's ping is far worse than everyone else's.

## Level balance

> **Paused.** The human-like balance bot hasn't matched how real runs of the tower floors go, so levels are balanced by playing them (and by `npm run report` once real stats come in). Don't tune levels with `npm run balance` unless that's explicitly asked for. The smoke test (every level possible, deterministic, nobody hit at the start) still runs as before.

```bash
npm run balance -- tower       # add attempts per level (32); without a set id it also runs the three original sets
```

The smoke-test bot has perfect reflexes, so it only proves a level is *possible*. `npm run balance` plays every level with a deliberately human-like bot (it reacts about 130 ms late, misjudges ball positions by a few pixels, presses and releases keys a little late, and avoids cursed drops) and reports, per level: pops needed, share of attempts cleared on one life, typical clear time, when it tends to die, and how often portals get used.

It was calibrated against real play: on the first version of Twists, real players cleared the portal levels first try and almost never cleared the original Triplets (0 of 6), Quadruplets (0 of 4) or Butterfingers (0 of 6); the bot reproduces that pattern. Read its clear rate as "a decent player, per attempt". Known blind spot: it cannot line up under balls that bounce on the spot, so it badly underrates people on Metronome, Drum Line and Through Traffic; those are checked with the perfect bot and by their timing windows instead (Metronome: 0.45 s safe per 0.75 s bounce; Drum Line: 0.28 s, then 0.20 s for the last five).

Targets used for Twists: introductions 60-80%, developments 40-60%, mixes 35-60%, finale 25-40%. Once real level stats accumulate (`npm run report`), trust those over the bot.

## Tests

```bash
npm run smoke     # a perfect-reflex bot plays every level: all must be beatable, deterministic, and fair at the start (nobody standing still is hit in the first 1.2 s, for 1-4 players)
npm run nettest   # 14 simulated network scenarios, 2-4 players
```

`e2e-check.html` (open on the dev server, `?players=4`) runs 2–4 real copies of the game in
iframes: join by link, change settings, play, pause, quit, results, and One Gun.

## The collector (worker/)

```bash
cd worker   # needs Node 20+
npx wrangler deploy
```

It's a standalone Worker on its own `*.workers.dev` address with no routes or domains, on
the free plan only. Going over the free limits makes uploads fail; it does not bill.
Uploads are only accepted from the game's own site, and listing or downloading needs the
secret read key.

## Files

| Path | What |
|---|---|
| `src/sim.ts` | The game rules. Deterministic: same inputs, same result. |
| `src/levels.ts` | All levels as data. |
| `src/rollback.ts` | Netcode. |
| `src/net.ts` | Rooms and peer-to-peer links. |
| `src/main.ts` | Menus, lobby, input, game loop, uploads. |
| `mobile/` | iOS app: a Capacitor wrapper around the built game, with its own README. Doesn't change the game. |
| `src/settings.ts` | Volume and key bindings. |
| `src/music.ts` | Chiptune music: tracks as data and the player. `music.html` on the dev server auditions them. |
| `src/stats.ts` | Lifetime stats. |
| `src/render.ts` | Drawing. |
| `scripts/` | Bot test, network tests, replay, report, fetch. |
| `worker/` | Log collector. |
