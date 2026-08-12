'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Search, UserX, Globe, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAppStore } from '@/lib/store';

type TabType = 'official' | 'test';

interface ParticipantRow {
  id: string;
  participantCode: string;
  name: string;
  className: string;
  division: string;
  language: 'english' | 'gujarati';
  isTest: boolean;
  createdAt: string;
  _count: {
    round1Attempts: number;
    round2Attempts: number;
  };
  latestRound1Score?: number | null;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Mobile Card for each participant ────────────────────
function ParticipantCard({ p }: { p: ParticipantRow }) {
  return (
    <Card className="border-[#D4C5A9]/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-[#063B2D] text-base truncate">{p.name}</p>
            <p className="text-sm text-[#5A6B5E] mt-0.5">
              {p.className} — Div {p.division}
            </p>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 text-xs border-[#C8A951]/60 text-[#063B2D] font-mono"
          >
            {p.participantCode}
          </Badge>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="secondary" className="text-xs gap-1">
            <Globe className="w-3 h-3" />
            {p.language === 'english' ? 'EN' : 'GU'}
          </Badge>
          <div className="flex items-center gap-1.5 text-sm text-[#5A6B5E]">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="font-semibold">
              {p._count.round1Attempts > 0
                ? p.latestRound1Score !== null && p.latestRound1Score !== undefined
                  ? `${p.latestRound1Score}`
                  : 'Submitted'
                : '—'}
            </span>
            <span className="text-[#5A6B5E]/60">R1</span>
          </div>
        </div>
        <p className="text-xs text-[#5A6B5E]/60">
          {formatDateTime(p.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function AdminParticipants() {
  const goBack = useAppStore((s) => s.goBack);
  const [activeTab, setActiveTab] = useState<TabType>('official');
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchParticipants = useCallback(async (tab: TabType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/participant?test=${tab === 'test'}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setParticipants(json.data);
        } else {
          setParticipants([]);
        }
      } else {
        setParticipants([]);
      }
    } catch {
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParticipants(activeTab);
  }, [activeTab, fetchParticipants]);

  const filtered = participants.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.participantCode.toLowerCase().includes(q) ||
      p.className.toLowerCase().includes(q) ||
      p.division.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#F7F2E7] flex flex-col">
      {/* ─── Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#F7F2E7]/90 backdrop-blur-md border-b border-[#D4C5A9]/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="shrink-0 hover:bg-[#063B2D]/10 text-[#063B2D]"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#063B2D] truncate">
              Participants
            </h1>
            <p className="text-xs sm:text-sm text-[#5A6B5E]">
              {loading
                ? 'Loading…'
                : `${filtered.length} of ${participants.length} participant${participants.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </header>

      {/* ─── Content ─────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* Tabs + Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Tabs */}
          <div className="flex rounded-xl bg-[#063B2D]/5 p-1 shrink-0">
            <button
              onClick={() => setActiveTab('official')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'official'
                  ? 'bg-[#063B2D] text-[#F7F2E7] shadow-sm'
                  : 'text-[#5A6B5E] hover:text-[#063B2D]'
              }`}
            >
              Official
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'test'
                  ? 'bg-[#063B2D] text-[#F7F2E7] shadow-sm'
                  : 'text-[#5A6B5E] hover:text-[#063B2D]'
              }`}
            >
              Test
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A6B5E]/50" />
            <input
              type="text"
              placeholder="Search by name, code, class…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#D4C5A9] bg-white text-sm text-[#063B2D] placeholder:text-[#5A6B5E]/50 focus:outline-none focus:ring-2 focus:ring-[#C8A951]/40 focus:border-[#C8A951]/60 transition-all"
            />
          </div>
        </div>

        {/* Table / Cards */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <div className="w-8 h-8 border-3 border-[#C8A951]/30 border-t-[#C8A951] rounded-full animate-spin" />
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center py-20 sm:py-28 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#063B2D]/5 mb-4">
                <UserX className="w-8 h-8 text-[#5A6B5E]/40" />
              </div>
              <p className="text-lg font-bold text-[#063B2D]/50 tracking-wider">
                NO PARTICIPANTS YET
              </p>
              {searchQuery.trim() && (
                <p className="text-sm text-[#5A6B5E]/50 mt-1">
                  No results for &quot;{searchQuery}&quot;
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-[#D4C5A9]/60 bg-white overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#063B2D]/[0.03] hover:bg-[#063B2D]/[0.03]">
                      <TableHead className="w-28 font-semibold text-[#063B2D]">Code</TableHead>
                      <TableHead className="font-semibold text-[#063B2D]">Name</TableHead>
                      <TableHead className="w-20 font-semibold text-[#063B2D]">Class</TableHead>
                      <TableHead className="w-20 font-semibold text-[#063B2D]">Div</TableHead>
                      <TableHead className="w-24 font-semibold text-[#063B2D]">Language</TableHead>
                      <TableHead className="w-32 text-center font-semibold text-[#063B2D]">
                        R1 Score
                      </TableHead>
                      <TableHead className="w-48 font-semibold text-[#063B2D]">
                        Registered At
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p, idx) => (
                      <TableRow
                        key={p.id}
                        className="border-t border-[#D4C5A9]/30 hover:bg-[#C8A951]/[0.04] transition-colors"
                      >
                        <TableCell className="font-mono text-sm font-semibold text-[#063B2D]">
                          {p.participantCode}
                        </TableCell>
                        <TableCell className="font-semibold text-[#063B2D]">
                          {p.name}
                        </TableCell>
                        <TableCell className="text-[#5A6B5E]">{p.className}</TableCell>
                        <TableCell className="text-[#5A6B5E]">{p.division}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Globe className="w-3 h-3" />
                            {p.language === 'english' ? 'English' : 'Gujarati'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {p._count.round1Attempts > 0 ? (
                            p.latestRound1Score !== null && p.latestRound1Score !== undefined ? (
                              <Badge
                                className="bg-[#063B2D] text-[#F7F2E7] hover:bg-[#063B2D]/90 font-bold text-sm"
                              >
                                {p.latestRound1Score}
                              </Badge>
                            ) : (
                              <span className="text-sm text-[#5A6B5E]">Submitted</span>
                            )
                          ) : (
                            <span className="text-sm text-[#5A6B5E]/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-[#5A6B5E]">
                          {formatDateTime(p.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((p) => (
                  <ParticipantCard key={p.id} p={p} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
