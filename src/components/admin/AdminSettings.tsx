'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

export default function AdminSettings() {
  const { goBack, competitionSettings, setCompetitionSettings } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    round1TotalQuestions: 10,
    round1TimeLimit: 0,
    round2TimeLimit: 60,
    allowRound2Retry: true,
    round2PenaltySeconds: 5,
  });

  useEffect(() => {
    if (competitionSettings) {
      setForm({
        round1TotalQuestions: competitionSettings.round1TotalQuestions,
        round1TimeLimit: competitionSettings.round1TimeLimit,
        round2TimeLimit: competitionSettings.round2TimeLimit,
        allowRound2Retry: competitionSettings.allowRound2Retry,
        round2PenaltySeconds: competitionSettings.round2PenaltySeconds,
      });
    }
  }, [competitionSettings]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/competition', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setCompetitionSettings(data.data);
        toast.success('Settings saved');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] islamic-pattern">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={goBack} className="text-[#0A0D14]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0A0D14]">Settings</h1>
        </div>

        <Card className="gold-glow">
          <CardHeader>
            <CardTitle className="text-[#0A0D14]">Competition Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div>
                <Label className="text-[#0A0D14]">Round 1: Total Questions</Label>
                <Input
                  type="number" min={1} max={50}
                  value={form.round1TotalQuestions}
                  onChange={(e) => setForm(f => ({ ...f, round1TotalQuestions: parseInt(e.target.value) || 10 }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[#0A0D14]">Round 1: Time Limit (seconds, 0 = no limit)</Label>
                <Input
                  type="number" min={0}
                  value={form.round1TimeLimit}
                  onChange={(e) => setForm(f => ({ ...f, round1TimeLimit: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[#0A0D14]">Round 2: Time Limit (seconds)</Label>
                <Input
                  type="number" min={10}
                  value={form.round2TimeLimit}
                  onChange={(e) => setForm(f => ({ ...f, round2TimeLimit: parseInt(e.target.value) || 60 }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[#0A0D14]">Allow Round 2 Retry</Label>
                <Switch
                  checked={form.allowRound2Retry}
                  onCheckedChange={(v) => setForm(f => ({ ...f, allowRound2Retry: v }))}
                />
              </div>
              <div>
                <Label className="text-[#0A0D14]">Round 2: Penalty Seconds (per incorrect attempt)</Label>
                <Input
                  type="number" min={0}
                  value={form.round2PenaltySeconds}
                  onChange={(e) => setForm(f => ({ ...f, round2PenaltySeconds: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
            </div>
            <Button onClick={save} disabled={saving} className="w-full bg-[#0A0D14] text-[#F4F5F7] hover:bg-[#1C2230]">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
