'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Trophy,
  Users,
} from 'lucide-react';

/**
 * The event-day control panel: /admin/control
 *
 * One screen with the only three things the quiz master needs while the hall is
 * full — who has arrived, where each round stands, and the switch to freeze a
 * round when it is finished.
 *
 * It exists because /admin/round2 is still full of controls for a Round 2 that
 * no longer works that way: Open, Lock, Reveal, Next Q and a join PIN, from when
 * the quiz master released one question at a time. Round 2 is self-paced now, so
 * those buttons either do nothing useful or actively confuse. Rather than gut a
 * working page mid-event, this is the screen to actually use on the day; the old
 * one stays reachable for anything not yet moved across.
 */

interface Snapshot {
  round1Status: string;
  round2Status: string;
  competitionStatus: string;
  participants: number;
  round1Submitted: number;
  q1Answered: number;
  q2Answered: number;
}

/** Written by the existing admin login; the same key /admin/round2 reads. */
const TOKEN_KEY = 'mes-admin-token';

export default function AdminControlPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [settings, stats, q1, q2] = await Promise.all([
        fetch('/api/competition', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/competition/stats', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/round2/live/leaderboard?question=1', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/round2/live/leaderboard?question=2', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setSnap({
        round1Status: settings?.data?.round1Status ?? '—',
        round2Status: settings?.data?.round2Status ?? '—',
        competitionStatus: settings?.data?.competitionStatus ?? '—',
        participants: stats?.data?.totalParticipants ?? 0,
        round1Submitted: stats?.data?.round1Submitted ?? 0,
        q1Answered: q1?.meta?.answered ?? 0,
        q2Answered: q2?.meta?.answered ?? 0,
      });
    } catch {
      setMsg({ tone: 'err', text: 'Could not reach the server' });
    }
  }, []);

  useEffect(() => {
    try {
      setToken(window.localStorage.getItem(TOKEN_KEY));
    } catch {
      /* private mode */
    }
    setCheckedAuth(true);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const setRound = async (round: 'round1' | 'round2', action: 'open' | 'close') => {
    setBusy(`${round}-${action}`);
    setConfirming(null);
    setMsg(null);
    try {
      // The admin token is a bearer header read from localStorage, the same way
      // /admin/round2 sends it. There is no cookie — requireAdmin only looks at
      // Authorization and x-admin-token.
      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ round, action }),
      });
      const json = await res.json();
      setMsg(
        json.success
          ? { tone: 'ok', text: json.message ?? 'Done' }
          : { tone: 'err', text: json.error ?? 'That did not work' }
      );
      if (json.success) load();
    } catch {
      setMsg({ tone: 'err', text: 'Could not reach the server' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#966700]">
              Admin
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[#0A0D14]">
              Event control
            </h1>
          </div>
          <button
            onClick={load}
            className="rounded-xl border border-[#D7DAE1] bg-white/70 p-2.5 text-[#5B6472] hover:bg-white"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </header>

        {msg && (
          <p
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              msg.tone === 'ok'
                ? 'border-[#1A7D70]/40 bg-[#1A7D70]/10 text-[#0F5D53]'
                : 'border-[#B3261E]/40 bg-[#B3261E]/08 text-[#B3261E]'
            }`}
          >
            {msg.text}
          </p>
        )}

        {checkedAuth && !token && (
          <p className="mb-5 rounded-xl border border-[#FFB000]/50 bg-[#FFB000]/15 px-4 py-3 text-sm text-[#7C5A00]">
            You are not signed in as admin, so the round controls will be
            refused. Sign in at{' '}
            <a href="/#/admin-login" className="font-bold underline">
              /#/admin-login
            </a>{' '}
            first. The figures below are public and still update.
          </p>
        )}

        {!snap ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-[#966700]" />
          </div>
        ) : (
          <>
            {/* Who is here */}
            <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<Users className="h-4 w-4" />} label="Signed up" value={snap.participants} />
              <Stat label="R1 submitted" value={snap.round1Submitted} />
              <Stat label="R2 Q1 answers" value={snap.q1Answered} />
              <Stat label="R2 Q2 answers" value={snap.q2Answered} />
            </section>

            {/* Leaderboards — the three that actually exist */}
            <section className="mb-5 rounded-2xl border border-[#D7DAE1] bg-white/70 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0A0D14]">
                <Trophy className="h-4 w-4 text-[#966700]" />
                Leaderboards
              </h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <BoardLink href="/leaderboard" title="Round 1" sub="Full standings" />
                <BoardLink href="/round2/board?q=1" title="Round 2 · Q1" sub={`${snap.q1Answered} answered`} />
                <BoardLink href="/round2/board?q=2" title="Round 2 · Q2" sub={`${snap.q2Answered} answered`} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[#5B6472]">
                Round 2 is scored per question — Q1 and Q2 are separate contests
                with separate winners. Open these directly on the projector.
              </p>
            </section>

            {/* Open / close */}
            <section className="rounded-2xl border border-[#D7DAE1] bg-white/70 p-4">
              <h2 className="mb-1 text-sm font-bold text-[#0A0D14]">Rounds</h2>
              <p className="mb-4 text-[11px] leading-relaxed text-[#5B6472]">
                Closing a round stops all further submissions and freezes its
                standings. It is reversible — reopening is one click.
              </p>

              <RoundRow
                name="Round 1"
                status={snap.round1Status}
                busy={busy}
                confirming={confirming}
                onConfirm={setConfirming}
                onSet={(a) => setRound('round1', a)}
                keyName="round1"
              />
              <div className="h-3" />
              <RoundRow
                name="Round 2"
                status={snap.round2Status}
                busy={busy}
                confirming={confirming}
                onConfirm={setConfirming}
                onSet={(a) => setRound('round2', a)}
                keyName="round2"
              />
            </section>

            <p className="mt-5 text-center text-[11px] text-[#5B6472]/70">
              Refreshes every 5 seconds · competition status:{' '}
              <span className="font-mono">{snap.competitionStatus}</span>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#D7DAE1] bg-white/70 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#5B6472]/80">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-[#0A0D14]">{value}</p>
    </div>
  );
}

function BoardLink({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-[#FFB000]/35 bg-[#FFB000]/10 px-3 py-2.5 transition-colors hover:bg-[#FFB000]/20"
    >
      <p className="text-sm font-bold text-[#0A0D14]">{title}</p>
      <p className="text-[11px] text-[#5B6472]">{sub}</p>
    </a>
  );
}

/**
 * Closing asks twice. It is the one control here that changes what students can
 * do, and a mis-tap during a live round would stop the hall dead.
 */
function RoundRow({
  name,
  status,
  busy,
  confirming,
  onConfirm,
  onSet,
  keyName,
}: {
  name: string;
  status: string;
  busy: string | null;
  confirming: string | null;
  onConfirm: (k: string | null) => void;
  onSet: (a: 'open' | 'close') => void;
  keyName: string;
}) {
  const closed = status === 'closed';
  const isConfirming = confirming === keyName;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D7DAE1] bg-white/60 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#0A0D14]">{name}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-[#5B6472]">
          {closed ? (
            <>
              <Lock className="h-3 w-3" /> closed
            </>
          ) : status === 'open' ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-[#1A7D70]" /> open — accepting submissions
            </>
          ) : (
            <>
              <AlertTriangle className="h-3 w-3 text-[#966700]" /> {status}
            </>
          )}
        </p>
      </div>

      {closed ? (
        <button
          onClick={() => onSet('open')}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg bg-[#1A7D70] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#166B60] disabled:opacity-50"
        >
          {busy === `${keyName}-open` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Reopen
        </button>
      ) : isConfirming ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSet('close')}
            disabled={busy !== null}
            className="rounded-lg bg-[#B3261E] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#9B211A] disabled:opacity-50"
          >
            {busy === `${keyName}-close` ? 'Closing…' : 'Yes, close it'}
          </button>
          <button
            onClick={() => onConfirm(null)}
            className="rounded-lg border border-[#D7DAE1] bg-white px-3 py-2 text-xs font-bold text-[#5B6472]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => onConfirm(keyName)}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-[#B3261E]/40 bg-white px-3.5 py-2 text-xs font-bold text-[#B3261E] hover:bg-[#B3261E]/05 disabled:opacity-50"
        >
          <Lock className="h-3.5 w-3.5" />
          Close round
        </button>
      )}
    </div>
  );
}
