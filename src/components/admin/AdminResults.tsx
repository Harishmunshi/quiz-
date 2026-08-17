'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { formatCompletionTime, formatTimerDisplay } from '@/lib/timer/formatter';

export default function AdminResults() {
  const { goBack } = useAppStore();
  const [round1Data, setRound1Data] = useState<unknown[]>([]);
  const [round2Data, setRound2Data] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/leaderboard/round1').then(r => r.json()),
        fetch('/api/leaderboard/round2').then(r => r.json()),
      ]);
      if (r1.success) setRound1Data(r1.data);
      if (r2.success) setRound2Data(r2.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const exportCSV = (round: number) => {
    window.open(`/api/export?round=${round}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] islamic-pattern">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={goBack} className="text-[#0A0D14]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0A0D14]">Results</h1>
        </div>

        <Tabs defaultValue="round1">
          <TabsList className="mb-6">
            <TabsTrigger value="round1" className="gap-2">
              <Trophy className="w-4 h-4" /> Round 1
            </TabsTrigger>
            <TabsTrigger value="round2" className="gap-2">
              <Zap className="w-4 h-4" /> Round 2
            </TabsTrigger>
          </TabsList>

          <TabsContent value="round1">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Round 1 Results</CardTitle>
                <Button onClick={() => exportCSV(1)} className="bg-[#0A0D14] text-[#F4F5F7]">
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-[#5B6472]">Loading...</div>
                ) : round1Data.length === 0 ? (
                  <div className="text-center py-8 text-[#5B6472]">
                    <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold">NO RESULTS YET</p>
                    <p className="text-sm">Waiting for participants to complete Round 1.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#D7DAE1]">
                          <th className="text-left py-3 px-2">Rank</th>
                          <th className="text-left py-3 px-2">Name</th>
                          <th className="text-left py-3 px-2 hidden md:table-cell">Class</th>
                          <th className="text-left py-3 px-2">Score</th>
                          <th className="text-left py-3 px-2 hidden sm:table-cell">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(round1Data as Array<Record<string, unknown>>).map((entry, i) => (
                          <motion.tr
                            key={entry.participantId as string}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`border-b border-[#D7DAE1]/50 ${i === 0 ? 'bg-[#FFB000]/10' : ''}`}
                          >
                            <td className="py-3 px-2 font-bold">
                              {i === 0 ? <Badge className="bg-[#FFB000] text-[#0A0D14]">#{i + 1}</Badge> : `#${i + 1}`}
                            </td>
                            <td className="py-3 px-2 font-medium">{entry.participantName as string}</td>
                            <td className="py-3 px-2 hidden md:table-cell text-[#5B6472]">{entry.className as string} - {entry.division as string}</td>
                            <td className="py-3 px-2 font-bold text-[#0A0D14]">{entry.score as number}/{entry.totalQuestions as number}</td>
                            <td className="py-3 px-2 hidden sm:table-cell text-[#5B6472]">{formatCompletionTime(entry.completionTimeMs as number)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="round2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Round 2 Results</CardTitle>
                <Button onClick={() => exportCSV(2)} className="bg-[#0A0D14] text-[#F4F5F7]">
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-[#5B6472]">Loading...</div>
                ) : round2Data.length === 0 ? (
                  <div className="text-center py-8 text-[#5B6472]">
                    <Zap className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold">NO RESULTS YET</p>
                    <p className="text-sm">Waiting for participants to complete Round 2.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#D7DAE1]">
                          <th className="text-left py-3 px-2">Rank</th>
                          <th className="text-left py-3 px-2">Name</th>
                          <th className="text-left py-3 px-2 hidden md:table-cell">Class</th>
                          <th className="text-left py-3 px-2">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(round2Data as Array<Record<string, unknown>>).map((entry, i) => (
                          <motion.tr
                            key={entry.participantId as string}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`border-b border-[#D7DAE1]/50 ${i === 0 ? 'bg-[#FFB000]/10' : ''}`}
                          >
                            <td className="py-3 px-2 font-bold">
                              {i === 0 ? <Badge className="bg-[#FFB000] text-[#0A0D14]">#{i + 1}</Badge> : `#${i + 1}`}
                            </td>
                            <td className="py-3 px-2 font-medium">{entry.participantName as string}</td>
                            <td className="py-3 px-2 hidden md:table-cell text-[#5B6472]">{entry.className as string} - {entry.division as string}</td>
                            <td className="py-3 px-2 font-mono font-bold text-[#966700]">{formatTimerDisplay(entry.finalTimeMs as number)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
