'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Loader2,
  Lock,
  Monitor,
  Play,
  RotateCcw,
  Settings2,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatSeconds, type Round2State } from '@/lib/round2/live';
import LiveLeaderboard, { type BoardEntry } from '@/components/round2/LiveLeaderboard';
import RouteBar from '@/components/nav/RouteBar';

/**
 * Round 2 live control panel.
 *
 * The quiz master drives the whole round from here:
 *   Open Q  →  watch answers arrive  →  Lock  →  Reveal  →  Next Q
 *
 * The token is read from localStorage, written by the existing admin login.
 */

const POLL_MS = 1500;
const TOKEN_KEY = 'mes-admin-token';

interface Stats {
  totalParticipants: number;
  submittedCount: number;
  pendingCount: number;
  correctCount: number;
  averagePositions: number;
  itemCount: number;
  fastestCorrect: { name: string; responseTimeMs: number } | null;
  correctSequence: string[];
  joinPin: string | null;
  qualifiedCount: number;
  pending: Array<{ id: string; name: string; schoolName: string }>;
  state: Round2State;
  currentQuestionNumber: number;
  questionTitle: string | null;
}

export default function AdminRound2Page() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [state, setState] = useState<Round2State>('idle');
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [seconds, setSeconds] = useState(30);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const secondsDirty = useRef(false);
  // Which (state, question) pair the board on screen was built for.
  const boardKey = useRef('');

  useEffect(() => {
    setToken(window.localStorage.getItem(TOKEN_KEY));
    setChecked(true);
  }, []);

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      // The leaderboard is the expensive one — a full aggregate over every
      // participant — and it only changes when a question closes. Fetch it on
      // the first pass and whenever the round moves, not on every tick.
      const wantBoard = boardKey.current !== `${state}|${currentQ}` || board.length === 0;

      const [sRes, stRes, lbRes] = await Promise.all([
        fetch('/api/round2/live/state', { cache: 'no-store' }),
        fetch('/api/round2/live/stats', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
        wantBoard
          ? fetch('/api/round2/live/leaderboard', { cache: 'no-store' })
          : Promise.resolve(null),
      ]);

      if (stRes.status === 401) {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        return;
      }

      const sJson = await sRes.json();
      if (sJson.success) {
        setState(sJson.data.state);
        setTotalQuestions(sJson.data.totalQuestions);
        setCurrentQ(sJson.data.currentQuestionNumber);
        // Don't stomp on the admin mid-edit of the seconds field.
        if (!secondsDirty.current) setSeconds(sJson.data.questionSeconds);
      }

      const stJson = await stRes.json();
      if (stJson.success) setStats(stJson.data);

      if (lbRes) {
        const lbJson = await lbRes.json();
        if (lbJson.success) {
          setBoard(lbJson.data as BoardEntry[]);
          boardKey.current = `${state}|${currentQ}`;
        }
      }
    } catch {
      /* transient — next tick will pick it up */
    }
  }, [token, state, currentQ, board.length]);

  useEffect(() => {
    if (!token) return;
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll, token]);

  const control = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!token) return;
    setBusy(action);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/round2/live/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg(json.message ?? `${action} applied`);
        secondsDirty.current = false;
        poll();
      } else {
        setErr(json.error ?? `${action} failed`);
      }
    } catch {
      setErr('Network error');
    } finally {
      setBusy(null);
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('login');
    setErr(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const json = await res.json();
      if (json.success) {
        window.localStorage.setItem(TOKEN_KEY, json.token);
        setToken(json.token);
      } else {
        setErr(json.error ?? 'Login failed');
      }
    } catch {
      setErr('Network error');
    } finally {
      setBusy(null);
    }
  };

  if (!checked) {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#966700]" />
        </div>
      </Shell>
    );
  }

  if (!token) {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center px-4">
          <form
            onSubmit={login}
            className="w-full max-w-sm rounded-2xl border border-[#FFB000]/25 bg-white/60 p-6"
          >
            <h1 className="mb-1 text-2xl font-black text-[#0A0D14]">Quiz Master Login</h1>
            <p className="mb-6 text-sm text-[#5B6472]">Round 2 live control</p>
            {err && (
              <p className="mb-4 rounded-lg border border-[#B3261E]/40 bg-[#B3261E]/08 px-3 py-2 text-sm text-[#B3261E]">
                {err}
              </p>
            )}
            <input
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="admin@mes.edu"
              className="mb-3 w-full rounded-lg border border-[#D7DAE1] bg-white/70 px-3 py-2.5 text-[#0A0D14] outline-none placeholder:text-[#5B6472]/60 focus:border-[#FFB000]"
            />
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              className="mb-5 w-full rounded-lg border border-[#D7DAE1] bg-white/70 px-3 py-2.5 text-[#0A0D14] outline-none placeholder:text-[#5B6472]/60 focus:border-[#FFB000]"
            />
            <Button
              type="submit"
              disabled={busy === 'login'}
              className="w-full bg-[#FFB000] py-6 font-bold text-[#0A0D14] hover:bg-[#FFC33D]"
            >
              {busy === 'login' ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign in'}
            </Button>
          </form>
        </div>
      </Shell>
    );
  }

  const submittedPct = stats?.totalParticipants
    ? Math.round((stats.submittedCount / stats.totalParticipants) * 100)
    : 0;

  return (
    <Shell>
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-[#966700]">QUIZ MASTER</p>
            <h1 className="text-3xl font-black text-[#0A0D14]">Round 2 Live Control</h1>
          </div>
          <div className="flex gap-2">
            <a href="/round2/display" target="_blank" rel="noreferrer">
              <Button variant="outline" className="border-[#FFB000]/40 bg-white/60 text-[#0A0D14] hover:bg-white/70">
                <Monitor className="mr-2 h-4 w-4" /> Open Board
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </a>
            <a href="/round2" target="_blank" rel="noreferrer">
              <Button variant="outline" className="border-[#FFB000]/40 bg-white/60 text-[#0A0D14] hover:bg-white/70">
                Student View
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>

        {totalQuestions === 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#FFB000]/50 bg-[#FFB000]/15 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#966700]" />
            <p className="text-sm text-[#7C5A00]">
              No active Round 2 questions yet. Add them in Admin → Questions with
              round set to 2, or POST a batch to{' '}
              <code className="rounded bg-black/30 px-1">/api/admin/questions/bulk</code>.
            </p>
          </div>
        )}

        {err && (
          <div className="mb-4 rounded-lg border border-[#B3261E]/40 bg-[#B3261E]/08 px-4 py-2 text-sm text-[#B3261E]">
            {err}
          </div>
        )}
        {msg && (
          <div className="mb-4 rounded-lg border border-[#1A7D70]/40 bg-[#1A7D70]/10 px-4 py-2 text-sm text-[#1A7D70]">
            {msg}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* ── Controls ─────────────────────────────────────────────── */}
          <div className="space-y-5 lg:col-span-2">
            <Panel>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-[#5B6472]/80">
                    CURRENT QUESTION
                  </p>
                  <p className="text-4xl font-black text-[#966700]">
                    {currentQ || '—'}
                    <span className="text-xl text-[#5B6472]/70">/{totalQuestions}</span>
                  </p>
                </div>
                <StateBadge state={state} />
              </div>

              {stats?.questionTitle && (
                <p className="mb-5 rounded-lg bg-white/60 px-4 py-3 text-[#0A0D14]">
                  {stats.questionTitle}
                </p>
              )}

              {/* Primary action row — the four buttons used during the round */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ActionButton
                  onClick={() => control('open')}
                  disabled={busy !== null || totalQuestions === 0 || state === 'open'}
                  busy={busy === 'open'}
                  icon={<Play className="h-5 w-5" />}
                  label={currentQ === 0 ? 'Start Q1' : 'Re-open'}
                  tone="gold"
                />
                <ActionButton
                  onClick={() => control('lock')}
                  disabled={busy !== null || state !== 'open'}
                  busy={busy === 'lock'}
                  icon={<Lock className="h-5 w-5" />}
                  label="Lock"
                  tone="neutral"
                />
                <ActionButton
                  onClick={() => control('reveal')}
                  disabled={busy !== null || (state !== 'open' && state !== 'locked')}
                  busy={busy === 'reveal'}
                  icon={<Eye className="h-5 w-5" />}
                  label="Reveal"
                  tone="neutral"
                />
                <ActionButton
                  onClick={() => control('next')}
                  disabled={busy !== null || totalQuestions === 0}
                  busy={busy === 'next'}
                  icon={<ChevronRight className="h-5 w-5" />}
                  label="Next Q"
                  tone="gold"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#D7DAE1] pt-4">
                <button
                  onClick={() => control('previous')}
                  disabled={busy !== null || currentQ <= 1}
                  className="flex items-center gap-1.5 rounded-lg bg-white/60 px-3 py-2 text-sm text-[#5B6472] hover:bg-white/70 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-[#5B6472]/80" />
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={seconds}
                    onChange={(e) => {
                      secondsDirty.current = true;
                      setSeconds(Number(e.target.value));
                    }}
                    className="w-20 rounded-lg border border-[#D7DAE1] bg-white/70 px-2 py-1.5 text-sm text-[#0A0D14] outline-none focus:border-[#FFB000]"
                  />
                  <span className="text-sm text-[#5B6472]/80">sec/question</span>
                  <button
                    onClick={() => control('settings', { questionSeconds: seconds })}
                    disabled={busy !== null}
                    className="rounded-lg bg-[#FFB000]/20 px-3 py-1.5 text-sm font-semibold text-[#966700] hover:bg-[#FFB000]/30"
                  >
                    Save
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Reset Round 2? This deletes every answer recorded in this round and returns to the idle screen. This cannot be undone.'
                      )
                    ) {
                      control('reset');
                    }
                  }}
                  disabled={busy !== null}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#B3261E]/10 px-3 py-2 text-sm font-semibold text-[#B3261E] hover:bg-[#B3261E]/15"
                >
                  <RotateCcw className="h-4 w-4" /> Reset Round
                </button>
              </div>
            </Panel>

            {/* ── Entry gate: who may play, and the code that lets them in ── */}
            <Panel>
              <div className="mb-4 flex items-center gap-2">
                <Lock className="h-5 w-5 text-[#966700]" />
                <h2 className="text-lg font-bold text-[#0A0D14]">Entry gate</h2>
                <span className="ml-auto font-mono text-sm tabular-nums text-[#5B6472]">
                  {stats?.qualifiedCount ?? 0} qualified
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Apply the Round 1 cut? This marks the top scorers as qualified for Round 2 and clears any previous cut.'
                      )
                    ) {
                      control('qualify');
                    }
                  }}
                  disabled={busy !== null}
                  className="flex flex-col items-start rounded-xl border border-[#D7DAE1] bg-white/70 px-4 py-3 text-left transition-colors hover:border-[#FFB000] disabled:opacity-50"
                >
                  <span className="text-sm font-bold text-[#0A0D14]">
                    1 · Qualify from Round 1
                  </span>
                  <span className="mt-0.5 text-xs text-[#5B6472]">
                    Top scorers by score, then fastest
                  </span>
                </button>

                <button
                  onClick={() => control('generate-pin')}
                  disabled={busy !== null}
                  className="flex flex-col items-start rounded-xl border border-[#D7DAE1] bg-white/70 px-4 py-3 text-left transition-colors hover:border-[#FFB000] disabled:opacity-50"
                >
                  <span className="text-sm font-bold text-[#0A0D14]">
                    2 · {stats?.joinPin ? 'New join code' : 'Show join code'}
                  </span>
                  <span className="mt-0.5 text-xs text-[#5B6472]">
                    Students type this to enter
                  </span>
                </button>
              </div>

              {stats?.joinPin && (
                <div className="mt-4 rounded-xl border-2 border-[#FFB000] bg-[#FFB000]/15 px-4 py-5 text-center">
                  <p className="font-mono text-[10px] tracking-[0.3em] text-[#7C5A00]">
                    JOIN CODE — READ THIS OUT
                  </p>
                  <p className="mt-1 font-mono text-5xl font-bold tracking-[0.25em] text-[#0A0D14]">
                    {stats.joinPin}
                  </p>
                </div>
              )}
            </Panel>

            {/* Live response monitor */}
            <Panel>
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#966700]" />
                <h2 className="text-lg font-bold text-[#0A0D14]">Responses</h2>
                <span className="ml-auto text-2xl font-black text-[#966700]">
                  {stats?.submittedCount ?? 0}
                  <span className="text-base text-[#5B6472]/70">
                    /{stats?.totalParticipants ?? 0}
                  </span>
                </span>
              </div>

              <div className="mb-5 h-3 overflow-hidden rounded-full bg-white/70">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#FFB000] to-[#1A7D70]"
                  animate={{ width: `${submittedPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetricTile
                  label="Submitted"
                  value={String(stats?.submittedCount ?? 0)}
                  sub={`of ${stats?.totalParticipants ?? 0}`}
                />
                <MetricTile
                  label="All correct"
                  value={String(stats?.correctCount ?? 0)}
                  tone="good"
                  sub="perfect sequences"
                />
                <MetricTile
                  label="Avg in place"
                  value={`${stats?.averagePositions ?? 0}`}
                  sub={`of ${stats?.itemCount ?? 12}`}
                />
              </div>

              {/* The answer key, admin-only. Never sent to a student screen
                  until the quiz master presses Reveal. */}
              {stats?.correctSequence && stats.correctSequence.length > 0 && (
                <details className="mt-4 rounded-xl border border-[#D7DAE1] bg-black/20 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#5B6472]/80">
                    Answer key (admin only)
                  </summary>
                  <ol className="mt-3 space-y-1">
                    {stats.correctSequence.map((label, i) => (
                      <li key={label} className="flex items-baseline gap-2.5">
                        <span className="w-5 text-right font-mono text-[11px] tabular-nums text-[#1A7D70]/70">
                          {i + 1}
                        </span>
                        <span className="text-sm text-[#0A0D14]/85">{label}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {stats?.fastestCorrect && (
                <p className="mt-4 rounded-lg bg-[#1A7D70]/10 px-4 py-2 text-sm text-[#1A7D70]">
                  Fastest correct: <strong>{stats.fastestCorrect.name}</strong> ·{' '}
                  {formatSeconds(stats.fastestCorrect.responseTimeMs)}
                </p>
              )}

              {stats && stats.pendingCount > 0 && state === 'open' && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold tracking-wider text-[#5B6472]/80">
                    STILL WAITING ON {stats.pendingCount}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.pending.slice(0, 24).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (window.confirm(`Remove ${p.name} from Round 2? Their answers stop counting immediately.`)) {
                            control('disqualify', { participantId: p.id });
                          }
                        }}
                        title="Click to remove from the round"
                        className="rounded-md bg-white/60 px-2 py-1 text-xs text-[#5B6472] transition-colors hover:bg-[#B3261E]/15 hover:text-[#B3261E]"
                      >
                        {p.name}
                      </button>
                    ))}
                    {stats.pendingCount > 24 && (
                      <span className="rounded-md bg-white/60 px-2 py-1 text-xs text-[#5B6472]/70">
                        +{stats.pendingCount - 24} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* ── Leaderboard ──────────────────────────────────────────── */}
          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#966700]" />
              <h2 className="text-lg font-bold text-[#0A0D14]">Standings</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <LiveLeaderboard entries={board} />
            </div>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}

// ── Presentational helpers ───────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen"
      style={{ background: 'linear-gradient(180deg, #F4F5F7 0%, #E9EBEF 100%)' }}
    >
      {/* On the Shell rather than the dashboard body, so the sign-in screen and
          the loading state get a way out too — they were dead ends before. */}
      <RouteBar section="Admin" label="Round 2 Live Control" />
      {children}
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#FFB000]/25 bg-white/60 p-5">{children}</div>
  );
}

function StateBadge({ state }: { state: Round2State }) {
  const map: Record<Round2State, { label: string; cls: string }> = {
    idle: { label: 'IDLE', cls: 'bg-white/70 text-[#5B6472]' },
    open: { label: 'ACCEPTING ANSWERS', cls: 'bg-[#1A7D70]/15 text-[#1A7D70]' },
    locked: { label: 'LOCKED', cls: 'bg-[#FFB000]/25 text-[#966700]' },
    revealed: { label: 'REVEALED', cls: 'bg-[#FFB000]/25 text-[#966700]' },
  };
  const s = map[state];
  return (
    <span className={`rounded-full px-4 py-1.5 text-xs font-black tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

function ActionButton({
  onClick,
  disabled,
  busy,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  icon: React.ReactNode;
  label: string;
  tone: 'gold' | 'neutral';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 text-sm font-bold transition',
        tone === 'gold'
          ? 'bg-[#FFB000] text-[#0A0D14] hover:bg-[#FFC33D]'
          : 'bg-white/70 text-[#0A0D14] hover:bg-white/80',
        'disabled:cursor-not-allowed disabled:opacity-35',
      ].join(' ')}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function MetricTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'neutral' | 'good';
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        tone === 'good'
          ? 'border-[#1A7D70]/40 bg-[#1A7D70]/[0.08]'
          : 'border-[#D7DAE1] bg-white/60'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5B6472]/70">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
          tone === 'good' ? 'text-[#1A7D70]' : 'text-[#966700]'
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-[#5B6472]/60">{sub}</p>
    </div>
  );
}
