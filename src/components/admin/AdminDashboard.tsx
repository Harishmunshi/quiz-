'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  LogOut,
  Users,
  FileCheck,
  Zap,
  Trophy,
  Play,
  Pause,
  Lock,
  Unlock,
  FlaskConical,
  Trash2,
  BookOpen,
  Puzzle,
  BarChart3,
  QrCode,
  ClipboardList,
  FileDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import type { CompetitionSettings, CompetitionStatus, RoundStatus } from '@/types/database';

// ── Animation Variants ──────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
  },
};

// ── Status Badge Helpers ────────────────────────────────────────
function statusBadge(status: CompetitionStatus | RoundStatus): React.ReactNode {
  const config: Record<string, { label: string; className: string }> = {
    draft:        { label: 'Draft',        className: 'bg-gray-200 text-gray-700 border-gray-300' },
    test:         { label: 'Test',         className: 'bg-amber-100 text-amber-700 border-amber-300' },
    live:         { label: 'Live',         className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    paused:       { label: 'Paused',       className: 'bg-orange-100 text-orange-700 border-orange-300' },
    completed:    { label: 'Completed',    className: 'bg-blue-100 text-blue-700 border-blue-300' },
    locked:       { label: 'Locked',       className: 'bg-gray-200 text-gray-600 border-gray-300' },
    open:         { label: 'Open',         className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    closed:       { label: 'Closed',       className: 'bg-red-100 text-red-700 border-red-300' },
  };
  const c = config[status] ?? config.draft;
  return (
    <Badge variant="outline" className={`text-xs font-semibold ${c.className}`}>
      {status === 'live' && <span className="relative flex h-1.5 w-1.5 mr-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600" /></span>}
      {c.label}
    </Badge>
  );
}

// ── Stat Card ───────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: 'emerald' | 'navy' | 'gold';
}) {
  const bgMap = {
    emerald: 'bg-emerald-deep/10 text-emerald-deep',
    navy:    'bg-navy-deep/10 text-navy-deep',
    gold:    'bg-gold-accent/15 text-gold-accent',
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2.5 ${bgMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-0.5 truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Control Button ──────────────────────────────────────────────
function ControlButton({
  icon: Icon,
  label,
  onClick,
  loading,
  variant = 'outline',
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: 'default' | 'outline' | 'destructive';
  disabled?: boolean;
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={loading || disabled}
      className="gap-2 h-10 transition-all"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden text-xs">{label}</span>
    </Button>
  );
}

// ── Nav Link ────────────────────────────────────────────────────
function NavLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-border/60 hover:bg-muted/60 hover:border-border transition-all text-left group"
    >
      <div className="rounded-md bg-emerald-deep/10 p-2 group-hover:bg-emerald-deep/15 transition-colors">
        <Icon className="w-4 h-4 text-emerald-deep" />
      </div>
      <span className="text-sm font-medium text-foreground group-hover:text-emerald-deep transition-colors">
        {label}
      </span>
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function AdminDashboard() {
  // Store
  const competitionSettings = useAppStore((s) => s.competitionSettings);
  const setCompetitionSettings = useAppStore((s) => s.setCompetitionSettings);
  const adminName = useAppStore((s) => s.adminName);
  const logoutAdmin = useAppStore((s) => s.logoutAdmin);
  const navigate = useAppStore((s) => s.navigate);

  // Local state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalParticipants: 0,
    round1Submissions: 0,
    round2Attempts: 0,
  currentLeader: '—',
  });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch competition settings on mount
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/competition');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setCompetitionSettings(json.data as CompetitionSettings);
        }
      }
    } catch {
      // Silent fail for background refresh
    }
  }, [setCompetitionSettings]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/participant');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const participants = json.data;
          setStats({
            totalParticipants: Array.isArray(participants) ? participants.length : (participants as { count?: number }).count ?? 0,
            round1Submissions: (json.round1Submissions as number) ?? 0,
            round2Attempts: (json.round2Attempts as number) ?? 0,
            currentLeader: (json.currentLeader as string) ?? '—',
          });
        }
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchSettings, fetchStats]);

  // Auto-refresh settings every 10s
  useEffect(() => {
    const interval = setInterval(fetchSettings, 10000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  // Competition control action
  const handleControlAction = async (actionKey: string, payload: Record<string, unknown>) => {
    setActionLoading(actionKey);
    setToast(null);
    try {
      const res = await fetch('/api/competition', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setCompetitionSettings(json.data as CompetitionSettings);
        }
        setToast({ message: `${actionKey.replace(/([A-Z])/g, ' $1').trim()} updated successfully`, type: 'success' });
      } else {
        const json = await res.json().catch(() => ({}));
        setToast({ message: (json.error as string) || 'Action failed', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error. Please try again.', type: 'error' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setToast(null), 4000);
    }
  };

  // Test mode toggle
  const handleTestModeToggle = async (enabled: boolean) => {
    await handleControlAction('testMode', { isTestMode: enabled });
  };

  // Clear test data
  const handleClearTestData = async () => {
    setActionLoading('clearTestData');
    setToast(null);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'test' }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setToast({ message: 'Test data cleared successfully', type: 'success' });
          fetchStats();
          fetchSettings();
        } else {
          setToast({ message: (json.error as string) || 'Failed to clear test data', type: 'error' });
        }
      } else {
        setToast({ message: 'Failed to clear test data', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error. Please try again.', type: 'error' });
    } finally {
      setActionLoading(null);
      setResetDialogOpen(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleLogout = () => {
    logoutAdmin();
  };

  const settings = competitionSettings;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center islamic-pattern">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gold-accent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen islamic-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* ── Toast Notification ─────────────────────────────────── */}
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Top Bar ──────────────────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-deep flex items-center justify-center gold-glow">
                <Shield className="w-5 h-5 text-gold-accent" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  Admin Dashboard
                </h1>
                <p className="text-xs text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{adminName || 'Admin'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {settings && (
                <div className="flex items-center gap-2 mr-auto sm:mr-2">
                  {statusBadge(settings.competitionStatus)}
                  {settings.isTestMode && (
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                      <FlaskConical className="w-3 h-3 mr-1" />
                      Test
                    </Badge>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-colors ml-auto"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </motion.div>

          {/* ── Stats Cards Row ──────────────────────────────────── */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard
              icon={Users}
              label="Total Participants"
              value={stats.totalParticipants}
              color="emerald"
            />
            <StatCard
              icon={FileCheck}
              label="Round 1 Submissions"
              value={stats.round1Submissions}
              color="navy"
            />
            <StatCard
              icon={Zap}
              label="Round 2 Attempts"
              value={stats.round2Attempts}
              color="gold"
            />
            <StatCard
              icon={Trophy}
              label="Current Leader"
              value={stats.currentLeader}
              sub={stats.currentLeader !== '—' ? 'Round 1 Top Scorer' : undefined}
              color="gold"
            />
          </motion.div>

          {/* ── Main Grid: Controls + Navigation ────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column: Competition Controls (2 cols) */}
            <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Competition Controls */}
              <Card className="border-border/60">
                <CardHeader className="pb-3 px-4 sm:px-6 pt-5 sm:pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Settings2 className="w-5 h-5 text-gold-accent" />
                        Competition Controls
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        Manage competition and round statuses
                      </CardDescription>
                    </div>
                    {settings && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Status:</span>
                        {statusBadge(settings.competitionStatus)}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6">
                  {/* Main competition buttons */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Competition
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ControlButton
                        icon={Play}
                        label="Start Competition"
                        onClick={() => handleControlAction('startCompetition', { competitionStatus: 'live' as CompetitionStatus })}
                        loading={actionLoading === 'startCompetition'}
                        disabled={settings?.competitionStatus === 'live'}
                      />
                      <ControlButton
                        icon={Pause}
                        label="Pause Competition"
                        onClick={() => handleControlAction('pauseCompetition', { competitionStatus: 'paused' as CompetitionStatus })}
                        loading={actionLoading === 'pauseCompetition'}
                        disabled={settings?.competitionStatus !== 'live'}
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Round controls */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Round 1 — Knowledge
                      </p>
                      {settings && statusBadge(settings.round1Status)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ControlButton
                        icon={Unlock}
                        label="Open Round 1"
                        onClick={() => handleControlAction('openRound1', { round1Status: 'open' as RoundStatus })}
                        loading={actionLoading === 'openRound1'}
                        disabled={settings?.round1Status === 'open'}
                      />
                      <ControlButton
                        icon={Lock}
                        label="Close Round 1"
                        onClick={() => handleControlAction('closeRound1', { round1Status: 'closed' as RoundStatus })}
                        loading={actionLoading === 'closeRound1'}
                        disabled={settings?.round1Status === 'closed'}
                        variant="destructive"
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Round 2 — Speed
                      </p>
                      {settings && statusBadge(settings.round2Status)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ControlButton
                        icon={Unlock}
                        label="Open Round 2"
                        onClick={() => handleControlAction('openRound2', { round2Status: 'open' as RoundStatus })}
                        loading={actionLoading === 'openRound2'}
                        disabled={settings?.round2Status === 'open'}
                      />
                      <ControlButton
                        icon={Lock}
                        label="Close Round 2"
                        onClick={() => handleControlAction('closeRound2', { round2Status: 'closed' as RoundStatus })}
                        loading={actionLoading === 'closeRound2'}
                        disabled={settings?.round2Status === 'closed'}
                        variant="destructive"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Test Mode Section */}
              <Card className="border-amber-200/60">
                <CardHeader className="pb-3 px-4 sm:px-6 pt-5 sm:pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <FlaskConical className="w-5 h-5 text-amber-600" />
                        Test Mode
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        Toggle test mode for practice runs. Test data is isolated.
                      </CardDescription>
                    </div>
                    <Switch
                      checked={settings?.isTestMode ?? false}
                      onCheckedChange={handleTestModeToggle}
                      disabled={actionLoading === 'testMode'}
                    />
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-muted-foreground">
                        Clear all test participants, attempts, and results.
                        <span className="block text-xs text-amber-600 font-medium mt-1">This action cannot be undone.</span>
                      </p>
                    </div>
                    <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2 shrink-0 ml-3"
                          disabled={actionLoading === 'clearTestData'}
                        >
                          {actionLoading === 'clearTestData' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">Clear Test Data</span>
                          <span className="sm:hidden">Clear</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            Clear All Test Data
                          </DialogTitle>
                          <DialogDescription>
                            This will permanently delete all test-mode participants, quiz attempts,
                            and results. This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                          <Button
                            variant="outline"
                            onClick={() => setResetDialogOpen(false)}
                            className="mt-2 sm:mt-0"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleClearTestData}
                            className="gap-2"
                          >
                            {actionLoading === 'clearTestData' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Yes, Clear Everything
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column: Navigation Links (1 col) */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/60">
                <CardHeader className="pb-3 px-4 sm:px-6 pt-5 sm:pt-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <ClipboardList className="w-5 h-5 text-gold-accent" />
                    Quick Navigation
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    Manage competition content and view results
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6">
                  <div className="space-y-2">
                    <NavLink
                      icon={BookOpen}
                      label="Manage Questions"
                      onClick={() => navigate('admin-questions')}
                    />
                    <NavLink
                      icon={Puzzle}
                      label="Manage Challenges"
                      onClick={() => navigate('admin-questions')}
                    />
                    <NavLink
                      icon={Users}
                      label="Participants"
                      onClick={() => navigate('admin-participants')}
                    />
                    <NavLink
                      icon={BarChart3}
                      label="Results"
                      onClick={() => navigate('admin-results')}
                    />
                    <Separator className="my-2" />
                    <NavLink
                      icon={Trophy}
                      label="Round 2 Live Control"
                      onClick={() => {
                        window.location.href = '/admin/round2';
                      }}
                    />
                    <NavLink
                      icon={QrCode}
                      label="QR Display"
                      onClick={() => navigate('display-qr')}
                    />
                    <NavLink
                      icon={Trophy}
                      label="Leaderboard Display"
                      onClick={() => navigate('display-leaderboard')}
                    />
                    <NavLink
                      icon={FileDown}
                      label="Export CSV"
                      onClick={() => navigate('admin-results')}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
