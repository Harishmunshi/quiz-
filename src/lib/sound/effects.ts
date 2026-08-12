// ============================================================
// SOUND EFFECTS — pure Web Audio API, no external assets
// ============================================================
// All sounds are synthesized on the fly. Mute state is persisted
// in localStorage so a student's choice is remembered across reloads.

const STORAGE_KEY = 'iqc:muted';

let _ctx: AudioContext | null = null;
let _muted = false;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    const Ctor: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
  }
  // Some browsers suspend until a user gesture
  if (_ctx.state === 'suspended') {
    void _ctx.resume().catch(() => undefined);
  }
  return _ctx;
}

export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  if (!_muted) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    _muted = stored === '1';
  }
  return _muted;
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* localStorage unavailable */
    }
  }
}

export function toggleMuted(): boolean {
  setMuted(!isMuted());
  return isMuted();
}

// ── Low-level helpers ───────────────────────────────────────────
function tone(
  frequency: number,
  durationMs: number,
  options: { type?: OscillatorType; volume?: number; delayMs?: number; attackMs?: number; releaseMs?: number } = {}
): void {
  const ac = ctx();
  if (!ac || isMuted()) return;

  const {
    type = 'sine',
    volume = 0.18,
    delayMs = 0,
    attackMs = 5,
    releaseMs = 60,
  } = options;

  const start = ac.currentTime + delayMs / 1000;
  const stop = start + durationMs / 1000;

  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + attackMs / 1000);
  gain.gain.setValueAtTime(volume, stop - releaseMs / 1000);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(stop + 0.02);
}

function sweep(
  fromHz: number,
  toHz: number,
  durationMs: number,
  options: { type?: OscillatorType; volume?: number } = {}
): void {
  const ac = ctx();
  if (!ac || isMuted()) return;

  const { type = 'sine', volume = 0.18 } = options;
  const start = ac.currentTime;
  const stop = start + durationMs / 1000;

  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 0.0001), stop);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.setValueAtTime(volume, stop - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(stop + 0.02);
}

// ── Named effects ───────────────────────────────────────────────

/** Short tick used during the 3-2-1 countdown. */
export function playCountdownBeep(): void {
  tone(660, 140, { type: 'square', volume: 0.12, releaseMs: 30 });
}

/** Louder, lower beep on "GO!". */
export function playGo(): void {
  sweep(440, 880, 220, { type: 'triangle', volume: 0.22 });
}

/** Triumphant ascending triad when a submission is correct. */
export function playCorrect(): void {
  tone(523.25, 130, { type: 'triangle', volume: 0.18, delayMs: 0 });
  tone(659.25, 130, { type: 'triangle', volume: 0.18, delayMs: 110 });
  tone(783.99, 220, { type: 'triangle', volume: 0.20, delayMs: 220 });
}

/** Low descending tone when wrong. */
export function playIncorrect(): void {
  sweep(330, 180, 320, { type: 'sawtooth', volume: 0.12 });
}

/** Short bright chime when a new result lands on the leaderboard. */
export function playLeaderboardTick(): void {
  tone(880, 90, { type: 'sine', volume: 0.10 });
}

/** Celebratory fanfare — used for new #1 / perfect score / Round 2 win. */
export function playFanfare(): void {
  tone(523.25, 160, { type: 'triangle', volume: 0.20, delayMs: 0 });
  tone(659.25, 160, { type: 'triangle', volume: 0.20, delayMs: 150 });
  tone(783.99, 160, { type: 'triangle', volume: 0.20, delayMs: 300 });
  tone(1046.5, 420, { type: 'triangle', volume: 0.22, delayMs: 450 });
}
