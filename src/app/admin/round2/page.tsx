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
  pending: Array<{ id: string; name: string; className: string; division: string }>;
  state: Round2State;
  currentQuestionNumber: number;
  questionTitle: string | null;
}

interface Entry {
  rank: number;
  participantId: string;
  participantName: string;
  className: string;
  division: string;
  score: number;
  correctAnswers: number;
  totalTimeMs: number;
}

export default function AdminRound2Page() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [board, setBoard] = useState<Entry[]>([]);
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

  useEffect(() => {
    setToken(window.localStorage.getItem(TOKEN_KEY));
    setChecked(true);
  }, []);

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      const [sRes, stRes, lbRes] = await Promise.all([
        fetch('/api/round2/live/state', { cache: 'no-store' }),
        fetch('/api/round2/live/stats', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/round2/live/leaderboard', { cache: 'no-store' }),
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

      const lbJson = await lbRes.json();
      if (lbJson.success) setBoard(lbJson.data as Entry[]);
    } catch {
      /* transient — next tick will pick it up */
    }
  }, [token]);

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
          <Loader2 className="h-8 w-8 animate-spin text-[#C8A951]" />
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
            className="w-full max-w-sm rounded-2xl border border-[#C8A951]/25 bg-white/5 p-6"
          >
            <h1 className="mb-1 text-2xl font-black text-[#F7F2E7]">Quiz Master Login</h1>
            <p className="mb-6 text-sm text-[#F7F2E7]/60">Round 2 live control</p>
            {err && (
              <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {err}
              </p>
            )}
            <input
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="admin@mes.edu"
              className="mb-3 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-[#F7F2E7] outline-none placeholder:text-[#F7F2E7]/30 focus:border-[#C8A951]"
            />
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              className="mb-5 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-[#F7F2E7] outline-none placeholder:text-[#F7F2E7]/30 focus:border-[#C8A951]"
            />
            <Button
              type="submit"
              disabled={busy === 'login'}
              className="w-full bg-[#C8A951] py-6 font-bold text-[#063B2D] hover:bg-[#d9bd6b]"
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
            <p className="text-xs font-bold tracking-[0.25em] text-[#C8A951]">QUIZ MASTER</p>
            <h1 className="text-3xl font-black text-[#F7F2E7]">Round 2 Live Control</h1>
          </div>
          <div className="flex gap-2">
            <a href="/round2/display" target="_blank" rel="noreferrer">
              <Button variant="outline" className="border-[#C8A951]/40 bg-white/5 text-[#F7F2E7] hover:bg-white/10">
                <Monitor className="mr-2 h-4 w-4" /> Open Board
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </a>
            <a href="/round2" target="_blank" rel="noreferrer">
              <Button variant="outline" className="border-[#C8A951]/40 bg-white/5 text-[#F7F2E7] hover:bg-white/10">
                Student View
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>

        {totalQuestions === 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-100">
              No active Round 2 questions yet. Add them in Admin → Questions with
              round set to 2, or POST a batch to{' '}
              <code className="rounded bg-black/30 px-1">/api/admin/questions/bulk</code>.
            </p>
          </div>
        )}

        {err && (
          <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {err}
          </div>
        )}
        {msg && (
          <div className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
            {msg}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* ── Controls ─────────────────────────────────────────────── */}
          <div className="space-y-5 lg:col-span-2">
            <Panel>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-[#F7F2E7]/50">
                    CURRENT QUESTION
                  </p>
                  <p className="text-4xl font-black text-[#C8A951]">
                    {currentQ || '—'}
                    <span className="text-xl text-[#F7F2E7]/40">/{totalQuestions}</span>
                  </p>
                </div>
                <StateBadge state={state} />
              </div>

              {stats?.questionTitle && (
                <p className="mb-5 rounded-lg bg-white/5 px-4 py-3 text-[#F7F2E7]">
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

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                <button
                  onClick={() => control('previous')}
                  disabled={busy !== null || currentQ <= 1}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-sm text-[#F7F2E7]/70 hover:bg-white/10 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-[#F7F2E7]/50" />
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={seconds}
                    onChange={(e) => {
                      secondsDirty.current = true;
                      setSeconds(Number(e.target.value));
                    }}
                    className="w-20 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-[#F7F2E7] outline-none focus:border-[#C8A951]"
                  />
                  <span className="text-sm text-[#F7F2E7]/50">sec/question</span>
                  <button
                    onClick={() => control('settings', { questionSeconds: seconds })}
                    disabled={busy !== null}
                    className="rounded-lg bg-[#C8A951]/20 px-3 py-1.5 text-sm font-semibold text-[#C8A951] hover:bg-[#C8A951]/30"
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
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/25"
                >
                  <RotateCcw className="h-4 w-4" /> Reset Round
                </button>
              </div>
            </Panel>

            {/* Live response monitor */}
            <Panel>
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#C8A951]" />
                <h2 className="text-lg font-bold text-[#F7F2E7]">Responses</h2>
                <span className="ml-auto text-2xl font-black text-[#C8A951]">
                  {stats?.submittedCount ?? 0}
                  <span className="text-base text-[#F7F2E7]/40">
                    /{stats?.totalParticipants ?? 0}
                  </span>
                </span>
              </div>

              <div className="mb-5 h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#C8A951] to-emerald-400"
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
                <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#F7F2E7]/45">
                    Answer key (admin only)
                  </summary>
                  <ol className="mt-3 space-y-1">
                    {stats.correctSequence.map((label, i) => (
                      <li key={label} className="flex items-baseline gap-2.5">
                        <span className="w-5 text-right font-mono text-[11px] tabular-nums text-emerald-400/70">
                          {i + 1}
                        </span>
                        <span className="text-sm text-[#F7F2E7]/85">{label}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {stats?.fastestCorrect && (
                <p className="mt-4 rounded-lg bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                  Fastest correct: <strong>{stats.fastestCorrect.name}</strong> ·{' '}
                  {formatSeconds(stats.fastestCorrect.responseTimeMs)}
                </p>
              )}

              {stats && stats.pendingCount > 0 && state === 'open' && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold tracking-wider text-[#F7F2E7]/50">
                    STILL WAITING ON {stats.pendingCount}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.pending.slice(0, 24).map((p) => (
                      <span
                        key={p.id}
                        className="rounded-md bg-white/5 px-2 py-1 text-xs text-[#F7F2E7]/60"
                      >
                        {p.name}
                      </span>
                    ))}
                    {stats.pendingCount > 24 && (
                      <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-[#F7F2E7]/40">
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
              <Trophy className="h-5 w-5 text-[#C8A951]" />
              <h2 className="text-lg font-bold text-[#F7F2E7]">Standings</h2>
            </div>
            {board.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#F7F2E7]/40">
                Appears after the first question closes
              </p>
            ) : (
              <div className="max-h-[600px] space-y-1.5 overflow-y-auto">
                {board.map((e) => (
                  <div
                    key={e.participantId}
                    className={[
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2',
                      e.rank === 1 ? 'bg-[#C8A951]/20' : 'bg-white/5',
                    ].join(' ')}
                  >
                    <span className="w-6 shrink-0 text-center text-sm font-black text-[#C8A951]">
                      {e.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#F7F2E7]">
                        {e.participantName}
                      </p>
                      <p className="text-[10px] text-[#F7F2E7]/40">
                        {e.className}-{e.division} · {formatSeconds(e.totalTimeMs)}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-black text-[#C8A951]">
                      {e.score}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
      style={{ background: 'linear-gradient(135deg, #063B2D 0%, #0A5E3F 50%, #063B2D 100%)' }}
    >
      {children}
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#C8A951]/25 bg-white/5 p-5">{children}</div>
  );
}

function StateBadge({ state }: { state: Round2State }) {
  const map: Record<Round2State, { label: string; cls: string }> = {
    idle: { label: 'IDLE', cls: 'bg-white/10 text-[#F7F2E7]/60' },
    open: { label: 'ACCEPTING ANSWERS', cls: 'bg-emerald-400/20 text-emerald-300' },
    locked: { label: 'LOCKED', cls: 'bg-amber-400/20 text-amber-300' },
    revealed: { label: 'REVEALED', cls: 'bg-[#C8A951]/25 text-[#C8A951]' },
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
          ? 'bg-[#C8A951] text-[#063B2D] hover:bg-[#d9bd6b]'
          : 'bg-white/10 text-[#F7F2E7] hover:bg-white/15',
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
          ? 'border-emerald-400/40 bg-emerald-400/[0.08]'
          : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#F7F2E7]/40">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
          tone === 'good' ? 'text-emerald-400' : 'text-[#C8A951]'
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-[#F7F2E7]/30">{sub}</p>
    </div>
  );
}
