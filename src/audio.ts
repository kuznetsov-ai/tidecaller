let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let pad: { osc: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode } | null = null;
let volume = 0.7;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setBusVolume(v: number): void {
  volume = v;
  if (master) master.gain.value = v;
}

export function unlockAudio(): void {
  const ac = context();
  if (!ac || !master || pad) return;
  const filter = ac.createGain();
  filter.gain.value = 0.045;
  const real = ac.createBiquadFilter();
  real.type = 'lowpass';
  real.frequency.value = 420;
  const osc = ac.createOscillator();
  const osc2 = ac.createOscillator();
  osc.type = 'sine';
  osc2.type = 'triangle';
  osc.frequency.value = 82;
  osc2.frequency.value = 123;
  osc.connect(real);
  osc2.connect(real);
  real.connect(filter);
  filter.connect(master);
  osc.start();
  osc2.start();
  pad = { osc, osc2, filter: real };
}

export function setPadTide(tide: number): void {
  if (!pad) return;
  const base = 74 + tide * 7;
  pad.osc.frequency.setTargetAtTime(base, ctx!.currentTime, 0.4);
  pad.osc2.frequency.setTargetAtTime(base * 1.5, ctx!.currentTime, 0.4);
  pad.filter.frequency.setTargetAtTime(280 + tide * 40, ctx!.currentTime, 0.5);
}

function blip(freq: number, dur: number, type: OscillatorType, gain: number, at = 0, slide = 0): void {
  const ac = context();
  if (!ac || !master || volume <= 0.001) return;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function sfx(name: string): void {
  unlockAudio();
  if (name === 'click') blip(640, 0.05, 'square', 0.03);
  else if (name === 'play') {
    blip(420, 0.08, 'triangle', 0.05);
    blip(680, 0.1, 'sine', 0.03, 0.02);
  }
  else if (name === 'hit') blip(140, 0.12, 'sawtooth', 0.05, 0, -60);
  else if (name === 'block') {
    blip(220, 0.06, 'square', 0.04);
    blip(180, 0.08, 'square', 0.03, 0.04);
  }
  else if (name === 'heal') {
    blip(520, 0.1, 'sine', 0.04);
    blip(780, 0.14, 'sine', 0.04, 0.06);
  }
  else if (name === 'tide') blip(300, 0.16, 'sine', 0.035, 0, 80);
  else if (name === 'coin') {
    blip(880, 0.06, 'square', 0.03);
    blip(1320, 0.08, 'square', 0.025, 0.05);
  }
  else if (name === 'win') {
    [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.18, 'triangle', 0.05, i * 0.09));
  }
  else if (name === 'lose') {
    blip(220, 0.3, 'sine', 0.05, 0, -80);
    blip(140, 0.4, 'triangle', 0.04, 0.1, -40);
  }
}
