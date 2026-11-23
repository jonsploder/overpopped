import type { Level } from './sim';

// Play field is 960 wide, floor at y=480. Ball x/y are centres.
// Ball sizes 0..5 (radius 8, 13, 20, 29, 40, 52). A size-n ball pops into two size n-1.
// `group` ties balls to `gate` blocks: a gate vanishes when its group is wiped out.

export const CAMPAIGN: Level[] = [
  {
    name: 'Warm-Up',
    hint: 'Move with the arrows, fire with Space.',
    touchHint: 'Slide your left thumb to move, hold your right to fire.',
    time: 30,
    start: [400, 320],
    balls: [{ x: 690, y: 250, size: 2, dir: -1 }],
  },
  {
    name: 'Two-Way Street',
    time: 45,
    start: [440, 520, 400, 560],
    balls: [
      { x: 230, y: 150, size: 3, dir: 1 },
      { x: 760, y: 260, size: 3, dir: -1 },
    ],
  },
  {
    name: 'The Big One',
    hint: 'Pop it at the top of its arc and the spikes help out.',
    time: 60,
    start: [800, 870],
    balls: [{ x: 330, y: 150, size: 4, dir: 1 }],
  },
  {
    name: 'Open Sesame',
    hint: 'Clear your side and the gate opens.',
    time: 60,
    start: [860, 920],
    rects: [{ x: 412, y: 0, w: 16, h: 480, gate: 1 }],
    balls: [
      { x: 640, y: 170, size: 3, dir: -1, group: 1 },
      { x: 280, y: 240, size: 2, dir: -1 },
      { x: 130, y: 180, size: 2, dir: 1 },
    ],
  },
  {
    name: 'Overhang',
    hint: 'The ledge blocks shots - and shelters you.',
    time: 70,
    rects: [{ x: 250, y: 264, w: 460, h: 18 }],
    balls: [
      { x: 480, y: 150, size: 3, dir: 1 },
      { x: 120, y: 300, size: 2, dir: 1 },
      { x: 840, y: 300, size: 2, dir: -1 },
    ],
  },
  {
    name: 'Squeeze',
    hint: 'The roof is coming down. Be quick.',
    time: 60,
    start: [440, 520, 400, 560],
    ceiling: { speed: 8, lift: 0 },
    balls: [
      { x: 260, y: 200, size: 3, dir: 1 },
      { x: 700, y: 200, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Trigger Happy',
    hint: 'Rapid fire. Too rapid, maybe.',
    time: 75,
    weapon: 'pulse',
    spikes: false, // with spikes, one shot at the top of its bounce sends both halves into the roof
    start: [140, 80],
    drops: ['shield', 'slow'],
    dropRate: 0.1,
    balls: [{ x: 560, y: 200, size: 5, dir: -1 }],
  },
  {
    name: 'Quickstep',
    time: 60,
    start: [460, 540, 500, 520],
    balls: [
      { x: 160, y: 220, size: 2, dir: 1, fast: true },
      { x: 480, y: 160, size: 2, dir: -1, fast: true },
      { x: 800, y: 220, size: 2, dir: -1, fast: true },
    ],
  },
  {
    name: 'Jailbreak',
    hint: 'Clear the room and the cages open.',
    time: 90,
    start: [380, 460, 340, 500],
    rects: [
      { x: 292, y: 0, w: 16, h: 480, gate: 1 },
      { x: 652, y: 0, w: 16, h: 480, gate: 1 },
    ],
    balls: [
      { x: 480, y: 160, size: 3, dir: 1, group: 1 },
      { x: 140, y: 200, size: 3, dir: 1, fast: true },
      { x: 820, y: 200, size: 3, dir: -1, fast: true },
    ],
  },
  {
    name: 'Careful What You Grab',
    hint: 'Not every gift is a favour.',
    time: 90,
    start: [480, 400],
    drops: ['beam', 'pulse', 'beam'],
    dropRate: 0.35,
    balls: [
      { x: 200, y: 170, size: 4, dir: 1 },
      { x: 760, y: 190, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Convoy',
    hint: 'The vine holds for a while. So do you.',
    time: 80,
    weapon: 'anchor',
    start: [840, 900],
    drops: ['shield', 'slow', 'time'],
    balls: [
      { x: 80, y: 200, size: 2, dir: 1 },
      { x: 200, y: 240, size: 2, dir: 1 },
      { x: 320, y: 200, size: 2, dir: 1 },
      { x: 440, y: 240, size: 2, dir: 1 },
      { x: 560, y: 200, size: 2, dir: 1 },
    ],
  },
  {
    name: 'Pressure Cooker',
    hint: 'Lower roof, shorter bounces, faster everything.',
    time: 62,
    ceiling: { speed: 7.2, lift: 0 }, // reaches head height at ~60 s
    ramp: 0.01,
    start: [480, 400],
    balls: [
      { x: 220, y: 200, size: 4, dir: 1 },
      { x: 760, y: 220, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Pinball',
    time: 100,
    start: [460, 540, 620, 700],
    rects: [
      { x: 170, y: 272, w: 60, h: 18 },
      { x: 450, y: 260, w: 60, h: 18 },
      { x: 730, y: 272, w: 60, h: 18 },
      { x: 310, y: 360, w: 50, h: 16 },
      { x: 600, y: 360, w: 50, h: 16 },
    ],
    balls: [
      { x: 90, y: 100, size: 3, dir: 1 },
      { x: 480, y: 80, size: 3, dir: -1 },
      { x: 870, y: 100, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Laser Surgery',
    hint: 'The beam cuts through everything. The spikes do the rest.',
    // A short clock, topped up by clocks from about two pops in five: waiting for the roof to
    // come down and spike the big ones runs out of time first (it takes the roof 22 s to reach them).
    time: 20,
    weapon: 'beam',
    spikes: true,
    ceiling: { speed: 8, lift: 4 },
    drops: ['time', 'time', 'time', 'time', 'shield'],
    dropRate: 0.5,
    start: [480, 400],
    balls: [
      { x: 180, y: 240, size: 4, dir: 1 },
      { x: 780, y: 240, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Rush Hour',
    time: 90,
    weapon: 'twin',
    start: [60, 120],
    balls: [
      { x: 480, y: 130, size: 4, dir: 1 },
      { x: 300, y: 330, size: 1, dir: 1, fast: true },
      { x: 420, y: 300, size: 1, dir: -1, fast: true },
      { x: 560, y: 330, size: 1, dir: 1, fast: true },
      { x: 700, y: 300, size: 1, dir: -1, fast: true },
      { x: 840, y: 330, size: 1, dir: -1, fast: true },
    ],
  },
  {
    name: 'Last Stand',
    hint: 'Everything at once.',
    time: 140,
    ceiling: { speed: 4, lift: 6 },
    ramp: 0.006,
    start: [330, 630],
    drops: ['twin', 'anchor', 'shield', 'slow', 'time', 'life', 'beam'],
    rects: [
      { x: 160, y: 0, w: 16, h: 480, gate: 1 },
      { x: 784, y: 0, w: 16, h: 480, gate: 1 },
    ],
    balls: [
      { x: 480, y: 180, size: 5, dir: 1, group: 1 },
      { x: 60, y: 220, size: 2, dir: 1, fast: true },
      { x: 110, y: 300, size: 2, dir: -1, fast: true },
      { x: 850, y: 220, size: 2, dir: 1, fast: true },
      { x: 900, y: 300, size: 2, dir: -1, fast: true },
    ],
  },
];

// Hard mode: extra mechanics.
//  armor: hits punt the ball upward instead of popping it, until the armour is gone
//  flip:  gravity for balls reverses every N seconds (roof is smooth on these levels)
//  wind:  sideways push on every ball
//  upsideDown: the view is upside down for the whole level
//  spin:  the view turns upside down every N seconds
//  move:  sliding blocks
export const HARD: Level[] = [
  {
    name: 'Tin Cans',
    hint: 'Armoured. Knock them about - or up into the spikes.',
    time: 80,
    balls: [
      { x: 240, y: 200, size: 3, dir: 1, armor: 2 },
      { x: 720, y: 200, size: 3, dir: -1, armor: 2 },
    ],
  },
  {
    name: 'Down Under',
    hint: 'Same game. Just the other way up.',
    time: 80,
    upsideDown: true,
    balls: [
      { x: 240, y: 200, size: 3, dir: 1 },
      { x: 720, y: 220, size: 2, dir: -1 },
    ],
  },
  {
    name: 'Upside Down',
    hint: 'Gravity flips every six seconds.',
    time: 90,
    start: [440, 520, 400, 560],
    flip: 6,
    balls: [
      { x: 250, y: 200, size: 3, dir: 1 },
      { x: 700, y: 220, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Headwind',
    hint: 'Slow one way. Very quick the other.',
    time: 90,
    wind: 55,
    start: [480, 400],
    balls: [
      { x: 150, y: 190, size: 3, dir: 1 },
      { x: 620, y: 220, size: 2, dir: -1 },
      { x: 820, y: 200, size: 2, dir: -1 },
    ],
  },
  {
    name: 'Carousel',
    hint: 'Left is left. Mostly.',
    time: 100,
    spin: 8,
    start: [320, 640],
    balls: [
      { x: 160, y: 200, size: 3, dir: 1 },
      { x: 480, y: 180, size: 3, dir: -1 },
      { x: 800, y: 200, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Elevator',
    time: 100,
    spikes: false,
    start: [120, 60],
    rects: [{ x: 330, y: 350, w: 300, h: 18, move: { dx: 0, dy: -180, period: 7 } }],
    balls: [
      { x: 480, y: 200, size: 4, dir: 1 },
      { x: 300, y: 220, size: 2, dir: 1, fast: true },
      { x: 820, y: 220, size: 2, dir: -1, fast: true },
    ],
  },
  {
    name: 'Crusher',
    hint: 'Shoot faster than it falls.',
    time: 90,
    weapon: 'pulse',
    ceiling: { speed: 13, lift: 7 },
    drops: ['shield', 'slow'],
    start: [150, 90],
    balls: [{ x: 560, y: 220, size: 5, dir: -1 }],
  },
  {
    name: 'Cannonballs',
    time: 120,
    weapon: 'anchor',
    start: [60, 120],
    balls: [
      { x: 240, y: 180, size: 4, dir: 1, armor: 2 },
      { x: 740, y: 180, size: 4, dir: -1, armor: 2 },
      { x: 400, y: 330, size: 1, dir: 1, fast: true },
      { x: 480, y: 300, size: 1, dir: -1, fast: true },
      { x: 560, y: 330, size: 1, dir: 1, fast: true },
    ],
  },
  {
    name: 'Weathervane',
    hint: 'Wind and gravity, both against you.',
    time: 110,
    start: [500, 560, 480, 540],
    wind: 50,
    flip: 7,
    balls: [
      { x: 300, y: 180, size: 4, dir: 1 },
      { x: 680, y: 200, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Lockdown',
    hint: 'One room at a time. The clock keeps speeding up.',
    time: 130,
    ramp: 0.008,
    start: [90, 40],
    rects: [
      { x: 312, y: 0, w: 16, h: 480, gate: 1 },
      { x: 632, y: 0, w: 16, h: 480, gate: 2 },
    ],
    balls: [
      { x: 220, y: 180, size: 3, dir: 1, group: 1 },
      { x: 480, y: 200, size: 3, dir: 1, group: 2, fast: true },
      { x: 800, y: 170, size: 4, dir: -1 },
    ],
  },
  {
    name: 'Vertigo',
    time: 100,
    start: [440, 540, 400, 580],
    spin: 7,
    ceiling: { speed: 6, lift: 9 },
    balls: [
      { x: 250, y: 200, size: 4, dir: 1 },
      { x: 720, y: 220, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Minefield',
    hint: 'The beam knocks. Then it pops. Then it pops again.',
    time: 100,
    weapon: 'beam',
    drops: ['beam', 'pulse', 'shield'],
    dropRate: 0.25,
    start: [430, 550, 240, 730],
    balls: [
      { x: 100, y: 200, size: 2, dir: 1, armor: 1 },
      { x: 250, y: 260, size: 2, dir: -1, armor: 1 },
      { x: 400, y: 200, size: 2, dir: 1, armor: 1 },
      { x: 560, y: 260, size: 2, dir: -1, armor: 1 },
      { x: 710, y: 200, size: 2, dir: 1, armor: 1 },
      { x: 860, y: 260, size: 2, dir: -1, armor: 1 },
    ],
  },
  {
    name: 'Eye of the Storm',
    hint: 'Everything at once.',
    time: 160,
    flip: 9,
    wind: 35,
    ramp: 0.005,
    start: [300, 440, 280, 480],
    drops: ['twin', 'anchor', 'shield', 'slow', 'time', 'life', 'beam'],
    balls: [
      { x: 480, y: 200, size: 5, dir: 1, armor: 1 },
      { x: 120, y: 250, size: 2, dir: 1, fast: true },
      { x: 840, y: 250, size: 2, dir: -1, fast: true },
    ],
  },
];

// Twists: a curriculum. Each idea is introduced alone and gently, developed once, and only
// then mixed with the others, two at a time, before a finale that uses everything.
//  portals: [ax, ay, bx, by] pairs, two-way. A ball coming out of a portal in the top half drops out.
//  chain:   [[x, y], ...] numbered portals, one-way: 1 -> 2 -> 3 -> ... -> back to 1
//  split:   pieces per pop (level-wide, or per ball); the number is drawn on the ball
//  playerSpeed / 'haste' drops: you run faster than you'd like
//  still:   a ball that bounces on the spot
// Floor portals sit at y 440 so rolling and bouncing balls actually pass through them.
// Balance is checked with `npm run balance -- twists` (a human-like bot); see README.

/** A row of small balls bouncing on the spot, optionally under caps that make the bounce quick. */
function drumLine(xs: number[], capUnderside: (k: number) => number, phase: (k: number) => number) {
  return {
    rects: xs.flatMap((x, k) => (capUnderside(k) ? [{ x: x - 15, y: capUnderside(k) - 10, w: 30, h: 10 }] : [])),
    balls: xs.map((x, k) => ({ x, y: 424 + phase(k), size: 0, dir: 1 as const, still: true })),
  };
}
const row = (n: number, from: number, gap: number) => Array.from({ length: n }, (_, k) => from + k * gap);

export const TWISTS: Level[] = [
  // ---------------------------------------------------------------- 1. portals
  {
    name: 'Wormhole',
    hint: 'A ball that rolls into the orange portal drops out of the blue one, high up.',
    time: 70,
    start: [620, 700, 580, 660],
    portals: [[150, 436, 760, 130]],
    balls: [
      { x: 330, y: 260, size: 3, dir: -1 },
      { x: 520, y: 300, size: 2, dir: -1 },
    ],
  },
  {
    name: 'Return Trip',
    hint: 'Portals work both ways. In one, out of the other.',
    // The portals stand a third of the way in: a ball low enough at one skips to the other, so it
    // either laps the middle or jumps clean over it, and one that is high sails past into the wings.
    time: 90,
    start: [520, 580, 480, 620],
    portals: [[290, 440, 670, 440]],
    balls: [
      { x: 420, y: 230, size: 3, dir: -1 },
      { x: 840, y: 280, size: 2, dir: -1 },
    ],
  },
  {
    name: 'Round Robin',
    hint: 'Numbered portals go one way: 1 to 2, 2 to 3, and 3 back to 1.',
    time: 90,
    start: [320, 640, 260, 700],
    chain: [[80, 440], [480, 120], [880, 440]],
    balls: [
      { x: 240, y: 240, size: 3, dir: -1 },
      { x: 720, y: 260, size: 2, dir: 1 },
    ],
  },
  // ---------------------------------------------------------------- 2. timing
  {
    name: 'Metronome',
    hint: 'They bounce on the spot. Step under one while it\'s up, fire, step out.',
    time: 75,
    dropRate: 0,
    start: [100, 60, 140, 20],
    ...drumLine(row(10, 190, 75), () => 0, () => 0),
  },
  // ---------------------------------------------------------------- 3. splits
  {
    name: 'Triplets',
    hint: 'The 3 on a ball means it splits three ways. The middle piece bounces on the spot, like a metronome.',
    time: 70,
    split: 3,
    start: [200, 140, 260, 80],
    balls: [{ x: 640, y: 220, size: 2, dir: -1 }],
  },
  {
    name: 'Three\'s a Crowd',
    hint: 'Two of them now. Finish one family before starting the next.',
    time: 90,
    split: 3,
    start: [480, 400, 560, 320],
    balls: [
      { x: 160, y: 220, size: 2, dir: 1 },
      { x: 800, y: 260, size: 1, dir: -1 },
    ],
  },
  {
    name: 'Quadruplets',
    hint: 'Four ways. Two of the pieces come almost straight back down: pop, then step aside.',
    time: 70,
    split: 4,
    start: [480, 400, 560, 320],
    balls: [
      { x: 140, y: 260, size: 1, dir: 1 },
      { x: 820, y: 260, size: 1, dir: -1 },
    ],
  },
  {
    name: 'Mixed Bag',
    hint: 'Read the numbers. Which one do you want to open first?',
    time: 100,
    start: [520, 600, 440, 680],
    balls: [
      { x: 100, y: 260, size: 1, dir: 1, split: 4 },
      { x: 240, y: 200, size: 2, dir: 1, split: 2 },
      { x: 880, y: 220, size: 2, dir: -1, split: 3 },
    ],
  },
  // ---------------------------------------------------------------- 4. speed
  {
    name: 'Too Much Coffee',
    hint: 'Lightning drops make you run far too fast for a few seconds. Step round them.',
    time: 70,
    drops: ['haste'],
    dropRate: 0.35,
    start: [200, 140, 260, 80],
    balls: [{ x: 660, y: 200, size: 3, dir: -1 }],
  },
  {
    name: 'Express',
    hint: 'This time you\'re fast the whole way through. Tap, don\'t hold.',
    time: 70,
    playerSpeed: 1.5,
    dropRate: 0,
    start: [480, 400, 560, 320],
    balls: [
      { x: 160, y: 240, size: 2, dir: 1 },
      { x: 800, y: 240, size: 2, dir: -1 },
    ],
  },
  // ---------------------------------------------------------------- 5. drops you don't want
  {
    name: 'Butterfingers',
    hint: 'Every drop is a curse: a gun that pops too much, or lightning. Leave them on the floor.',
    time: 90,
    weapon: 'twin',
    drops: ['beam', 'pulse', 'haste', 'beam', 'pulse'],
    dropRate: 0.4,
    start: [480, 400, 560, 320],
    balls: [
      { x: 140, y: 200, size: 3, dir: 1 },
      { x: 820, y: 240, size: 2, dir: -1 },
    ],
  },
  // ---------------------------------------------------------------- 6. two ideas at a time
  {
    name: 'Flip Side',
    hint: 'When gravity flips, the balls bounce on the roof, and the high portal is the one they fall into.',
    time: 100,
    flip: 7,
    start: [480, 400, 560, 320],
    portals: [[140, 436, 820, 60]],
    balls: [
      { x: 280, y: 240, size: 3, dir: -1 },
      { x: 700, y: 240, size: 3, dir: 1 },
    ],
  },
  {
    name: 'Espresso Shot',
    hint: 'Fast feet and a wormhole: what you just popped is about to land somewhere else.',
    time: 80,
    playerSpeed: 1.5,
    dropRate: 0,
    start: [560, 640, 480, 400],
    portals: [[120, 436, 800, 130]],
    balls: [
      { x: 300, y: 240, size: 3, dir: -1 },
    ],
  },
  {
    name: 'Hall of Mirrors',
    hint: 'Four portals in one loop, and a gate. Your side first.',
    time: 110,
    start: [200, 130, 270, 340],
    rects: [{ x: 472, y: 0, w: 16, h: 480, gate: 1 }],
    chain: [[60, 440], [700, 130], [900, 440], [260, 130]],
    balls: [
      { x: 420, y: 200, size: 3, dir: 1, group: 1 },
      { x: 700, y: 240, size: 2, dir: 1, split: 3 },
    ],
  },
  {
    name: 'Split Ends',
    hint: 'Three-way splits, and the floor portals keep bringing them back round.',
    time: 100,
    split: 3,
    start: [440, 520, 360, 600],
    portals: [[200, 440, 760, 440]],
    balls: [
      { x: 330, y: 220, size: 2, dir: -1 },
    ],
  },
  {
    name: 'Do Not Touch',
    hint: 'Three-way splits, and every drop is the wrong gun.',
    time: 100,
    split: 3,
    drops: ['beam', 'pulse'],
    dropRate: 0.3,
    start: [480, 400, 560, 320],
    balls: [
      { x: 160, y: 220, size: 2, dir: 1 },
      { x: 800, y: 240, size: 1, dir: -1 },
    ],
  },
  {
    name: 'Jitterbug',
    hint: 'Fast feet and three-way splits. The ones bouncing on the spot are the ones you\'ll run into.',
    time: 80,
    playerSpeed: 1.25,
    split: 3,
    dropRate: 0,
    start: [200, 140, 260, 80],
    balls: [{ x: 660, y: 220, size: 2, dir: -1 }],
  },
  {
    name: 'Numbers Game',
    hint: 'Every pop lifts the roof. Fours lift it most, but make the most mess.',
    time: 100,
    ceiling: { speed: 4, lift: 9 },
    start: [480, 400, 560, 320],
    balls: [
      { x: 140, y: 260, size: 1, dir: -1, split: 4 },
      { x: 820, y: 240, size: 2, dir: 1, split: 2 },
      { x: 660, y: 240, size: 2, dir: 1, split: 3 },
    ],
  },
  {
    name: 'Through Traffic',
    hint: 'A row of metronomes, and one ball that keeps coming round through the portals.',
    time: 110,
    dropRate: 0,
    start: [270, 480, 690, 60],
    portals: [[50, 440, 910, 440]],
    ...(() => {
      // eight, in pairs: tight inside a pair, room between pairs to meet the ball that comes round
      const d = drumLine([140, 210, 330, 400, 560, 630, 750, 820], () => 0, (k) => (k * 19) % 48);
      return { rects: d.rects, balls: [...d.balls, { x: 480, y: 200, size: 2, dir: 1 as const }] };
    })(),
  },
  {
    name: 'Drum Line',
    hint: 'Ten of them, out of step, and the caps make them quick. The last five are quicker.',
    time: 80,
    dropRate: 0,
    start: [30, 70, 30, 70],
    ...drumLine(row(10, 120, 80), (k) => (k < 5 ? 406 : 410), (k) => (k * 13) % 48),
  },
  // ---------------------------------------------------------------- 7. three at a time, then everything
  {
    name: 'Revolving Door',
    hint: 'A portal loop, mixed splits and lightning on the floor.',
    time: 120,
    chain: [[80, 440], [480, 120], [880, 440]],
    drops: ['haste', 'haste', 'shield', 'time'],
    dropRate: 0.25,
    start: [400, 560, 320, 640],
    balls: [
      { x: 240, y: 240, size: 2, dir: -1, split: 3 },
      { x: 720, y: 240, size: 3, dir: 1, split: 2 },
    ],
  },
  {
    name: 'Chaos Theory',
    hint: 'Everything at once.',
    time: 150,
    ramp: 0.003,
    chain: [[70, 440], [480, 120], [890, 440]],
    drops: ['haste', 'shield', 'twin', 'beam', 'time', 'life'],
    dropRate: 0.25,
    start: [340, 620, 280, 680],
    balls: [
      { x: 200, y: 220, size: 3, dir: -1, split: 2 },
      { x: 760, y: 220, size: 2, dir: 1, split: 3 },
      { x: 480, y: 180, size: 1, dir: 1, split: 4 },
    ],
  },
];

/** Levels made for the tower: Photo Finish, then one built around each odd weapon. */
export const EXTRA: Level[] = [
  {
    // Everyone starts behind three balls heading for the far wall, and the clock runs out
    // about when the first one gets there (~4.2 s): run under them, get ahead, shoot.
    // One shot each (split: 1), and no drops, so no extra time.
    name: 'Photo Finish',
    time: 5,
    start: [40, 80, 120, 160],
    drops: [],
    split: 1,
    balls: [
      { x: 230, y: 330, size: 2, dir: 1, fast: true },
      { x: 340, y: 360, size: 2, dir: 1, fast: true },
      { x: 450, y: 390, size: 2, dir: 1, fast: true },
    ],
  },
  { name: 'Point Blank', time: 150, weapon: 'stub', drops: [], start: [200, 760, 160, 800], balls: [{ x: 480, y: 140, size: 5, dir: 1 }] },
  { name: 'Light Show', time: 80, weapon: 'lance', drops: ['lance', 'rocket'], dropRate: 0.25, start: [440, 520, 400, 560],
    balls: [{ x: 240, y: 160, size: 3, dir: 1 }, { x: 720, y: 160, size: 3, dir: -1 }] },
  { name: 'En Garde', time: 90, weapon: 'sword', drops: [], start: [440, 520, 400, 560],
    balls: [{ x: 200, y: 200, size: 2, dir: 1 }, { x: 760, y: 200, size: 2, dir: -1 }] },
  { name: 'Broadside', time: 90, weapon: 'side', drops: [], start: [440, 520, 400, 560],
    balls: [{ x: 220, y: 180, size: 3, dir: 1 }, { x: 740, y: 200, size: 2, dir: -1 }] },
  // Every shot has to hit: a harpoon, vine or rocket that reaches the roof costs a life.
  // Only those three drop (a laser always reaches the roof).
  { name: 'Every Shot Counts', hint: 'Miss, and you\'re out.', time: 90, weapon: 'harpoon', noMiss: true,
    drops: ['anchor', 'harpoon', 'rocket'], dropRate: 0.3, start: [440, 520, 400, 560],
    balls: [{ x: 220, y: 200, size: 3, dir: 1 }, { x: 740, y: 180, size: 2, dir: -1 }] },
  { name: 'Arms Race', time: 100, drops: ['sword', 'side', 'rocket', 'lance', 'stub'], dropRate: 0.4, start: [440, 520, 400, 560],
    balls: [{ x: 200, y: 160, size: 4, dir: 1 }, { x: 760, y: 180, size: 3, dir: -1 }] },
];

// The Tower: every level in one climb. Each floor opens on a new idea, and is a checkpoint.
const byName = new Map([...CAMPAIGN, ...HARD, ...TWISTS, ...EXTRA].map((L) => [L.name, L]));
const floor = (name: string, levels: string[]) => ({
  name,
  levels: levels.map((n) => { const L = byName.get(n); if (!L) throw new Error(`no level called ${n}`); return L; }),
});
export const FLOORS = [
  floor('Ground Floor', ['Warm-Up', 'Two-Way Street', 'The Big One', 'Open Sesame', 'Overhang', 'Squeeze', 'Trigger Happy']),
  floor('The Workshop', ['Quickstep', 'Jailbreak', 'Careful What You Grab', 'Convoy', 'Pressure Cooker', 'Pinball', 'Laser Surgery', 'Rush Hour']),
  floor('Portal Gallery', ['Wormhole', 'Return Trip', 'Round Robin', 'Metronome', 'Through Traffic']),
  floor('Split Level', ['Triplets', "Three's a Crowd", 'Quadruplets', 'Mixed Bag', 'Split Ends', 'Numbers Game', 'Hall of Mirrors']),
  floor('The Armoury', ['Point Blank', 'Light Show', 'En Garde', 'Broadside', 'Every Shot Counts', 'Arms Race']),
  floor('Heavy Weather', ['Tin Cans', 'Down Under', 'Upside Down', 'Headwind', 'Cannonballs', 'Weathervane', 'Flip Side']),
  floor('Machine Room', ['Carousel', 'Elevator', 'Crusher', 'Lockdown', 'Vertigo', 'Minefield']),
  floor('Overclocked', ['Too Much Coffee', 'Express', 'Photo Finish', 'Butterfingers', 'Espresso Shot', 'Do Not Touch', 'Jitterbug']),
  floor('Summit', ['Last Stand', 'Drum Line', 'Revolving Door', 'Eye of the Storm', 'Chaos Theory']),
];
export const TOWER: Level[] = FLOORS.flatMap((f, i) => f.levels.map((L) => ({ ...L, floor: i + 1 })));
/** Index in TOWER of each floor's first level. */
export const FLOOR_START = FLOORS.map((_, i) => FLOORS.slice(0, i).reduce((a, f) => a + f.levels.length, 0));
if (TOWER.length !== byName.size) throw new Error('every level must be on exactly one floor');

/** The tower's order (level names) before v23 moved Drum Line from the end of the Portal Gallery to the Summit. */
export const V22_TOWER: string[] = (() => {
  const n = TOWER.map((L) => L.name).filter((x) => x !== 'Drum Line');
  n.splice(n.indexOf('Through Traffic') + 1, 0, 'Drum Line');
  return n;
})();
/** And before v22 moved Photo Finish to Overclocked, Quickstep to the Workshop and Last Stand to the Summit.
 *  Old saves and level logs count from these. */
export const V21_TOWER: string[] = (() => {
  const moved = ['Photo Finish', 'Quickstep', 'Last Stand'];
  const n = V22_TOWER.filter((x) => !moved.includes(x));
  n.splice(n.indexOf('Trigger Happy') + 1, 0, 'Photo Finish', 'Quickstep');
  n.splice(n.indexOf('Rush Hour') + 1, 0, 'Last Stand');
  return n;
})();

// The first three are the sets the tower was built from; old session logs still refer to them by position.
export const SETS = [
  { id: 'campaign', name: 'Campaign', levels: CAMPAIGN },
  { id: 'hard', name: 'Hard mode', levels: HARD },
  { id: 'twists', name: 'Twists', levels: TWISTS },
  { id: 'tower', name: 'The Tower', levels: TOWER },
];
export const TOWER_SET = 3;
