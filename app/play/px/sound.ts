// Chiptune sound for the game, synthesized in the browser with Web Audio: no audio files. Effects and a short looping
// soundtrack in three moods. Nothing plays until the player has clicked something, as browsers require.
type Mood = "trail" | "debate" | "night" | "off";
let ctx: AudioContext | null = null;
let master: GainNode | null = null, sfxBus: GainNode | null = null, musBus: GainNode | null = null;
let sfxOn = true, musOn = true, mood: Mood = "off", timer: number | null = null, step = 0, nextT = 0;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 0.22; musBus.connect(master);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(f: number, t0: number, d: number, type: OscillatorType = "square", v = 0.25, bus: GainNode | null = sfxBus, slide?: number) {
  const a = ac(); if (!a || !bus) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + d + 0.02);
}
function noise(t0: number, d: number, v = 0.2, hp = 800, bus: GainNode | null = sfxBus) {
  const a = ac(); if (!a || !bus) return;
  const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), x = buf.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
  const g = a.createGain(); g.gain.value = v;
  src.connect(f); f.connect(g); g.connect(bus); src.start(t0);
}

export type Sfx = "click" | "coin" | "good" | "bad" | "crowd" | "boo" | "whoosh" | "type" | "buzz" | "bell" | "fanfare" | "lose" | "tick" | "card" | "dice" | "alarm" | "airstrike" | "step" | "lead";
export function sfx(k: Sfx) {
  if (!sfxOn) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime + 0.01;
  switch (k) {
    case "click": tone(880, t, 0.05, "square", 0.12); break;
    case "type": tone(1200 + Math.random() * 300, t, 0.025, "square", 0.05); break;
    case "tick": tone(1500, t, 0.02, "triangle", 0.08); break;
    case "step": tone(180, t, 0.04, "triangle", 0.1); break;
    case "coin": tone(988, t, 0.08, "square", 0.18); tone(1319, t + 0.07, 0.22, "square", 0.18); break;
    case "good": [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.14, "square", 0.16)); break;
    case "bad": tone(330, t, 0.18, "sawtooth", 0.16, sfxBus, 160); tone(220, t + 0.16, 0.3, "sawtooth", 0.16, sfxBus, 110); break;
    case "crowd": noise(t, 1.1, 0.22, 600); noise(t + 0.15, 0.9, 0.16, 1500); [0, 0.12, 0.26, 0.4].forEach((d) => noise(t + d, 0.06, 0.25, 2500)); break;
    case "boo": tone(140, t, 0.8, "sawtooth", 0.1, sfxBus, 95); noise(t, 0.8, 0.08, 300); break;
    case "whoosh": noise(t, 0.35, 0.18, 2000); break;
    case "buzz": tone(110, t, 0.35, "square", 0.2); break;
    case "bell": tone(1568, t, 0.6, "triangle", 0.2); tone(2093, t, 0.6, "sine", 0.1); break;
    case "card": noise(t, 0.08, 0.2, 3000); tone(660, t + 0.05, 0.06, "square", 0.08); break;
    case "dice": for (let i = 0; i < 6; i++) noise(t + i * 0.06, 0.04, 0.2, 2500); break;
    case "alarm": [0, 0.25].forEach((d) => { tone(880, t + d, 0.12, "square", 0.16); tone(660, t + d + 0.12, 0.12, "square", 0.16); }); break;
    case "airstrike": tone(1400, t, 0.5, "sine", 0.12, sfxBus, 200); noise(t + 0.48, 0.5, 0.3, 120); break;
    case "lead": tone(784, t, 0.1, "square", 0.18); tone(1047, t + 0.1, 0.1, "square", 0.18); tone(784, t + 0.2, 0.1, "square", 0.18); tone(1047, t + 0.3, 0.2, "square", 0.18); break;
    case "fanfare": [523, 523, 523, 698, 880, 784, 880, 1047].forEach((f, i) => tone(f, t + [0, 0.12, 0.24, 0.36, 0.6, 0.84, 0.96, 1.08][i], i === 7 ? 0.7 : 0.16, "square", 0.2)); break;
    case "lose": [392, 370, 349, 330].forEach((f, i) => tone(f, t + i * 0.28, 0.32, "triangle", 0.2)); break;
  }
}

// ------------------------------------------------------------- the soundtrack
const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const SONGS: Record<Exclude<Mood, "off">, { bpm: number; lead: number[]; bass: number[] }> = {
  // eight bars of eighth notes; 0 is a rest
  trail: { bpm: 132, lead: [72, 0, 76, 79, 0, 76, 74, 72, 74, 0, 77, 81, 0, 79, 77, 74, 72, 0, 76, 79, 84, 0, 83, 79, 77, 76, 74, 72, 74, 76, 72, 0],
    bass: [48, 48, 55, 55, 50, 50, 57, 57, 48, 48, 55, 55, 53, 53, 55, 55] },
  debate: { bpm: 116, lead: [69, 0, 0, 72, 0, 71, 0, 69, 67, 0, 0, 69, 0, 64, 0, 0, 69, 0, 0, 72, 0, 74, 0, 76, 74, 72, 71, 69, 71, 0, 0, 0],
    bass: [45, 45, 45, 45, 41, 41, 43, 43, 45, 45, 45, 45, 40, 40, 44, 44] },
  night: { bpm: 148, lead: [76, 76, 0, 76, 0, 72, 76, 0, 79, 0, 0, 0, 67, 0, 0, 0, 72, 0, 67, 0, 64, 0, 69, 71, 70, 69, 67, 76, 79, 81, 77, 79],
    bass: [48, 48, 48, 48, 52, 52, 55, 55, 53, 53, 50, 50, 55, 55, 43, 43] },
};
function sched() {
  const a = ac(); if (!a || mood === "off") return;
  const song = SONGS[mood as Exclude<Mood, "off">]; const dt = 60 / song.bpm / 2;
  while (nextT < a.currentTime + 0.25) {
    const i = step % song.lead.length;
    if (song.lead[i]) tone(N(song.lead[i]), nextT, dt * 0.9, "square", 0.12, musBus);
    if (i % 2 === 0) { const b = song.bass[(i / 2) % song.bass.length]; tone(N(b), nextT, dt * 1.8, "triangle", 0.28, musBus); }
    if (mood === "night" && i % 4 === 2) noise(nextT, 0.05, 0.12, 4000, musBus);
    if (i % 4 === 0) noise(nextT, 0.03, 0.08, 6000, musBus);
    nextT += dt; step++;
  }
}
export function music(m: Mood) {
  mood = m;
  if (timer != null) { window.clearInterval(timer); timer = null; }
  if (m === "off" || !musOn) return;
  const a = ac(); if (!a) return;
  nextT = a.currentTime + 0.1; step = 0;
  timer = window.setInterval(sched, 90);
}
export function setSound(s: { sfx?: boolean; music?: boolean }) {
  if (s.sfx != null) sfxOn = s.sfx;
  if (s.music != null) { musOn = s.music; if (!musOn && timer != null) { window.clearInterval(timer); timer = null; } else if (musOn && mood !== "off" && timer == null) music(mood); }
}
export const soundState = () => ({ sfx: sfxOn, music: musOn });
/** Wake the audio context from a click. */
export const unlock = () => { ac(); };
