// ============================================================
// CONFETTI — light DOM-based, no extra dependencies
// ============================================================
// Throws colored squares on screen. Used for: new #1, perfect score,
// Round 2 victory. Respects `prefers-reduced-motion`.

const COLORS = [
  '#C8A951', // gold
  '#F7F2E7', // ivory
  '#063B2D', // emerald
  '#0A8A66', // emerald light
  '#1B3A8A', // navy
];

interface Piece {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  color: string;
  life: number;
}

let _pieces: Piece[] = [];
let _raf: number | null = null;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function makePiece(): Piece {
  const el = document.createElement('div');
  const size = 6 + Math.random() * 8;
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = `${size}px`;
  el.style.height = `${size * 1.4}px`;
  el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9999';
  el.style.willChange = 'transform, opacity';
  el.style.opacity = '1';
  el.style.transformOrigin = 'center';
  el.style.borderRadius = Math.random() < 0.3 ? '50%' : '1px';
  document.body.appendChild(el);

  // Launch from random point along the top half
  const startX = window.innerWidth * (0.15 + Math.random() * 0.7);
  const startY = -20;

  return {
    el,
    x: startX,
    y: startY,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 3,
    rot: Math.random() * 360,
    vRot: (Math.random() - 0.5) * 12,
    size,
    color: '#000',
    life: 1.0,
  };
}

function tick() {
  const gravity = 0.18;
  const drag = 0.992;
  const width = window.innerWidth;
  const height = window.innerHeight;

  for (let i = _pieces.length - 1; i >= 0; i--) {
    const p = _pieces[i];
    p.vy += gravity;
    p.vx *= drag;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vRot;

    if (p.y > height + 40) {
      p.life -= 0.04;
    }
    if (p.life <= 0 || p.x < -50 || p.x > width + 50) {
      p.el.remove();
      _pieces.splice(i, 1);
      continue;
    }

    const opacity = Math.max(0, Math.min(1, p.life));
    p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg)`;
    p.el.style.opacity = String(opacity);
  }

  if (_pieces.length > 0) {
    _raf = requestAnimationFrame(tick);
  } else {
    _raf = null;
  }
}

function spawn(count: number) {
  if (prefersReducedMotion()) return;
  for (let i = 0; i < count; i++) {
    _pieces.push(makePiece());
  }
  if (_raf === null) {
    _raf = requestAnimationFrame(tick);
  }
}

// ── Public API ───────────────────────────────────────────────────

/** Small celebratory burst — perfect score, Round 2 win. */
export function fireConfetti(): void {
  spawn(80);
}

/** Bigger double-burst from both sides — for new #1 / fanfare. */
export function fireConfettiBig(): void {
  spawn(160);
  setTimeout(() => spawn(120), 350);
  setTimeout(() => spawn(80), 700);
}
