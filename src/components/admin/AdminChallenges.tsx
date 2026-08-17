'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

interface Challenge {
  id: string;
  challengeNumber: number;
  prompt: string;
  items: string;
  correctOrder: string;
  timeLimitMs: number;
  maxAttempts: number;
  isActive: boolean;
}

export default function AdminChallenges() {
  const { goBack } = useAppStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [form, setForm] = useState({
    challengeNumber: 1,
    prompt: '',
    itemsText: '',
    correctOrderText: '',
    timeLimitMs: 30000,
    maxAttempts: 3,
    isActive: true,
  });

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/round2/challenges');
      const data = await res.json();
      if (data.success) setChallenges(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChallenges(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ challengeNumber: (challenges.length + 1), prompt: '', itemsText: '', correctOrderText: '', timeLimitMs: 30000, maxAttempts: 3, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (c: Challenge) => {
    setEditing(c);
    setForm({
      challengeNumber: c.challengeNumber,
      prompt: c.prompt,
      itemsText: (JSON.parse(c.items) as string[]).join(', '),
      correctOrderText: (JSON.parse(c.correctOrder) as string[]).join(', '),
      timeLimitMs: c.timeLimitMs,
      maxAttempts: c.maxAttempts,
      isActive: c.isActive,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const items = form.itemsText.split(',').map(s => s.trim()).filter(Boolean);
    const correctOrder = form.correctOrderText.split(',').map(s => s.trim()).filter(Boolean);

    if (items.length < 2 || correctOrder.length < 2) {
      toast.error('At least 2 items required');
      return;
    }

    if (JSON.stringify([...items].sort()) !== JSON.stringify([...correctOrder].sort())) {
      toast.error('Items and correct order must contain the same elements');
      return;
    }

    if (editing) {
      const res = await fetch('/api/admin/challenges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...form, items, correctOrder }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Challenge updated'); setDialogOpen(false); fetchChallenges(); }
    } else {
      const res = await fetch('/api/round2/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeNumber: form.challengeNumber, prompt: form.prompt, items, correctOrder, timeLimitMs: form.timeLimitMs, maxAttempts: form.maxAttempts, isActive: form.isActive }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Challenge created'); setDialogOpen(false); fetchChallenges(); }
    }
  };

  const deleteChallenge = async (id: string) => {
    const res = await fetch(`/api/admin/challenges?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { toast.success('Deleted'); fetchChallenges(); }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] islamic-pattern">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={goBack} className="text-[#0A0D14]"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0A0D14]">Round 2 Challenges</h1>
          </div>
          <Button onClick={openNew} className="bg-[#0A0D14] text-[#F4F5F7]"><Plus className="w-4 h-4 mr-2" /> Add Challenge</Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[#5B6472]">Loading...</div>
        ) : challenges.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-[#5B6472]"><GripVertical className="w-12 h-12 mx-auto mb-2 opacity-30" /><p className="font-semibold">NO CHALLENGES YET</p></CardContent></Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {challenges.map((c) => {
                const items = JSON.parse(c.items) as string[];
                const correct = JSON.parse(c.correctOrder) as string[];
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <Card className={c.isActive ? '' : 'opacity-60'}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-[#966700]">#{c.challengeNumber}</span>
                            <CardTitle className="text-lg">{c.prompt}</CardTitle>
                            <Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteChallenge(c.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="text-sm text-[#5B6472]">Items:</span>
                          {items.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-sm text-[#5B6472]">Correct:</span>
                          {correct.map((item) => <Badge key={item} className="bg-[#0A0D14] text-[#F4F5F7]">{item}</Badge>)}
                        </div>
                        <div className="flex gap-4 mt-3 text-sm text-[#5B6472]">
                          <span>Time: {c.timeLimitMs / 1000}s</span>
                          <span>Max attempts: {c.maxAttempts}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Challenge' : 'New Challenge'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Challenge Number</Label><Input type="number" min={1} value={form.challengeNumber} onChange={e => setForm(f => ({ ...f, challengeNumber: parseInt(e.target.value) || 1 }))} className="mt-1" /></div>
              <div><Label>Prompt</Label><Textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} className="mt-1" placeholder="e.g., Arrange these in order..." /></div>
              <div><Label>Scrambled Items (comma separated)</Label><Input value={form.itemsText} onChange={e => setForm(f => ({ ...f, itemsText: e.target.value }))} className="mt-1" placeholder="Z, Y, X, W, V, U" /></div>
              <div><Label>Correct Order (comma separated)</Label><Input value={form.correctOrderText} onChange={e => setForm(f => ({ ...f, correctOrderText: e.target.value }))} className="mt-1" placeholder="U, V, W, X, Y, Z" /></div>
              <div><Label>Time Limit (ms)</Label><Input type="number" value={form.timeLimitMs} onChange={e => setForm(f => ({ ...f, timeLimitMs: parseInt(e.target.value) || 30000 }))} className="mt-1" /></div>
              <div><Label>Max Attempts</Label><Input type="number" min={1} value={form.maxAttempts} onChange={e => setForm(f => ({ ...f, maxAttempts: parseInt(e.target.value) || 3 }))} className="mt-1" /></div>
              <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} /></div>
              <Button onClick={save} className="w-full bg-[#0A0D14] text-[#F4F5F7]">{editing ? 'Update' : 'Create'} Challenge</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
