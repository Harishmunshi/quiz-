'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/lib/store';
import { questionFormSchema, type QuestionFormInput } from '@/lib/validation/schemas';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BookOpen,
  CheckCircle2,
  XCircle,
  Search,
} from 'lucide-react';
import type { Question } from '@/types/database';

// ── Types ────────────────────────────────────────────────────
interface QuestionFormData {
  questionNumber: number;
  englishQuestion: string;
  gujaratiQuestion: string;
  optionAEnglish: string;
  optionBEnglish: string;
  optionCEnglish: string;
  optionDEnglish: string;
  optionAGujarati: string;
  optionBGujarati: string;
  optionCGujarati: string;
  optionDGujarati: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  marks: number;
  round: number;
  isActive: boolean;
}

const EMPTY_FORM: QuestionFormData = {
  questionNumber: 1,
  englishQuestion: '',
  gujaratiQuestion: '',
  optionAEnglish: '',
  optionBEnglish: '',
  optionCEnglish: '',
  optionDEnglish: '',
  optionAGujarati: '',
  optionBGujarati: '',
  optionCGujarati: '',
  optionDGujarati: '',
  correctOption: 'A',
  marks: 1,
  round: 1,
  isActive: true,
};

// ── Animation Variants ────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ── Question Form Dialog ──────────────────────────────────────
function QuestionFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: QuestionFormData | null;
  onSubmit: (data: QuestionFormData) => void;
  isLoading: boolean;
}) {
  const isEditing = initialData !== null;
  const [form, setForm] = useState<QuestionFormData>(initialData ?? EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback((field: keyof QuestionFormData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleSubmit = () => {
    // Validate
    const result = questionFormSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0];
        if (field) fieldErrors[String(field)] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gold-accent" />
            {isEditing ? 'Edit Question' : 'Add New Question'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the question details below.'
              : 'Fill in all fields to create a new question.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Row: Question Number + Marks + Round */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Question Number</Label>
              <Input
                type="number"
                min={1}
                value={form.questionNumber}
                onChange={(e) => updateField('questionNumber', parseInt(e.target.value) || 1)}
                className="h-9"
              />
              {errors.questionNumber && (
                <p className="text-xs text-destructive">{errors.questionNumber}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Marks</Label>
              <Input
                type="number"
                min={1}
                value={form.marks}
                onChange={(e) => updateField('marks', parseInt(e.target.value) || 1)}
                className="h-9"
              />
              {errors.marks && (
                <p className="text-xs text-destructive">{errors.marks}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Round</Label>
              <Select
                value={String(form.round)}
                onValueChange={(val) => updateField('round', parseInt(val))}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Round 1</SelectItem>
                  <SelectItem value="2">Round 2</SelectItem>
                </SelectContent>
              </Select>
              {errors.round && (
                <p className="text-xs text-destructive">{errors.round}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* English Question */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">English Question</Label>
            <Textarea
              value={form.englishQuestion}
              onChange={(e) => updateField('englishQuestion', e.target.value)}
              placeholder="Enter question in English..."
              rows={3}
              className="resize-none"
            />
            {errors.englishQuestion && (
              <p className="text-xs text-destructive">{errors.englishQuestion}</p>
            )}
          </div>

          {/* Gujarati Question */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Gujarati Question</Label>
            <Textarea
              value={form.gujaratiQuestion}
              onChange={(e) => updateField('gujaratiQuestion', e.target.value)}
              placeholder="Enter question in Gujarati..."
              rows={3}
              className="resize-none"
            />
            {errors.gujaratiQuestion && (
              <p className="text-xs text-destructive">{errors.gujaratiQuestion}</p>
            )}
          </div>

          <Separator />

          {/* English Options */}
          <div>
            <Label className="text-xs font-medium mb-3 block">English Options</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as const).map((key) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gold-accent w-5">{key}</span>
                    <Input
                      placeholder={`Option ${key} (English)`}
                      value={form[`option${key}English` as keyof QuestionFormData] as string}
                      onChange={(e) => updateField(`option${key}English` as keyof QuestionFormData, e.target.value)}
                      className="h-9"
                    />
                  </div>
                  {errors[`option${key}English`] && (
                    <p className="text-xs text-destructive pl-7">
                      {errors[`option${key}English`]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Gujarati Options */}
          <div>
            <Label className="text-xs font-medium mb-3 block">Gujarati Options</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as const).map((key) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gold-accent w-5">{key}</span>
                    <Input
                      placeholder={`Option ${key} (Gujarati)`}
                      value={form[`option${key}Gujarati` as keyof QuestionFormData] as string}
                      onChange={(e) => updateField(`option${key}Gujarati` as keyof QuestionFormData, e.target.value)}
                      className="h-9"
                    />
                  </div>
                  {errors[`option${key}Gujarati`] && (
                    <p className="text-xs text-destructive pl-7">
                      {errors[`option${key}Gujarati`]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Correct Option + Active Switch */}
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-medium">Correct Option</Label>
              <Select
                value={form.correctOption}
                onValueChange={(val) => updateField('correctOption', val)}
              >
                <SelectTrigger className="h-9 w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Option A</SelectItem>
                  <SelectItem value="B">Option B</SelectItem>
                  <SelectItem value="C">Option C</SelectItem>
                  <SelectItem value="D">Option D</SelectItem>
                </SelectContent>
              </Select>
              {errors.correctOption && (
                <p className="text-xs text-destructive">{errors.correctOption}</p>
              )}
            </div>
            <div className="flex items-center gap-3 pb-1">
              <Label className="text-xs font-medium">Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => updateField('isActive', checked)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-9"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="h-9"
            style={{ backgroundColor: '#C8A951', color: '#071A2B' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditing ? 'Saving…' : 'Creating…'}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {isEditing ? 'Save Changes' : 'Create Question'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ───────────────────────────────────────────

/** Admin token written at login; every call to the gated admin API needs it. */
function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('mes-admin-token') : null;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export default function AdminQuestions() {
  const { navigate, goBack } = useAppStore();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Fetch questions ────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/questions', { headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to fetch questions');
      const data = await res.json();
      setQuestions(data.data);
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // ── Filter questions ───────────────────────────────────────
  const filteredQuestions = questions.filter((q) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      q.englishQuestion.toLowerCase().includes(query) ||
      q.gujaratiQuestion.toLowerCase().includes(query) ||
      `Q${q.questionNumber}`.includes(query)
    );
  });

  // ── Handle create/update ──────────────────────────────────
  const handleFormSubmit = async (formData: QuestionFormData) => {
    setIsSaving(true);
    try {
      const isEditing = editingQuestion !== null;
      const url = '/api/admin/questions';
      const method = isEditing ? 'PUT' : 'POST';
      const body = isEditing
        ? { id: editingQuestion.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to ${isEditing ? 'update' : 'create'} question`);
      }

      setDialogOpen(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (err) {
      console.error('Error saving question:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Handle delete ──────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/questions?id=${deleteTarget.id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete question');
      }
      setDeleteTarget(null);
      fetchQuestions();
    } catch (err) {
      console.error('Error deleting question:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────
  const openAddDialog = () => {
    setEditingQuestion(null);
    setDialogOpen(true);
  };

  const openEditDialog = (q: Question) => {
    setEditingQuestion(q);
    setDialogOpen(true);
  };

  const getCorrectText = (q: Question) => {
    const optionMap: Record<string, string> = {
      A: q.optionAEnglish,
      B: q.optionBEnglish,
      C: q.optionCEnglish,
      D: q.optionDEnglish,
    };
    const text = optionMap[q.correctOption] || '';
    return text.length > 40 ? text.substring(0, 40) + '…' : text;
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F7F2E7' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={goBack}
              className="h-9 gap-2 text-sm"
              style={{ color: '#063B2D' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              onClick={openAddDialog}
              className="h-9 gap-2 text-sm font-medium"
              style={{ backgroundColor: '#C8A951', color: '#071A2B' }}
            >
              <Plus className="w-4 h-4" />
              Add Question
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#063B2D' }}>
              Manage Questions
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(6, 59, 45, 0.6)' }}>
              {questions.length} question{questions.length !== 1 ? 's' : ''} total
            </p>
          </motion.div>

          {/* Search */}
          {questions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(6, 59, 45, 0.4)' }} />
                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </motion.div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="max-w-5xl mx-auto">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#C8A951' }} />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && questions.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(200, 169, 81, 0.1)' }}
              >
                <BookOpen className="w-8 h-8" style={{ color: '#C8A951' }} />
              </div>
              <h3 className="text-lg font-semibold mb-1" style={{ color: '#063B2D' }}>
                No questions yet
              </h3>
              <p className="text-sm mb-4" style={{ color: 'rgba(6, 59, 45, 0.6)' }}>
                Create your first question to get started.
              </p>
              <Button
                onClick={openAddDialog}
                className="h-10 gap-2 text-sm font-medium"
                style={{ backgroundColor: '#C8A951', color: '#071A2B' }}
              >
                <Plus className="w-4 h-4" />
                Add Question
              </Button>
            </motion.div>
          )}

          {/* Question List — Desktop Table */}
          {!isLoading && filteredQuestions.length > 0 && (
            <>
              {/* Desktop: Table View */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="hidden lg:block"
              >
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr
                            className="border-b"
                            style={{ borderColor: 'rgba(200, 169, 81, 0.2)' }}
                          >
                            <th
                              className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'rgba(6, 59, 45, 0.6)' }}
                            >
                              #
                            </th>
                            <th
                              className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'rgba(6, 59, 45, 0.6)' }}
                            >
                              Question (English)
                            </th>
                            <th
                              className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'rgba(6, 59, 45, 0.6)' }}
                            >
                              Correct Answer
                            </th>
                            <th
                              className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'rgba(6, 59, 45, 0.6)' }}
                            >
                              Round
                            </th>
                            <th
                              className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'rgba(6, 59, 45, 0.6)' }}
                            >
                              Status
                            </th>
                            <th
                              className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'rgba(6, 59, 45, 0.6)' }}
                            >
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence>
                            {filteredQuestions.map((q) => (
                              <motion.tr
                                key={q.id}
                                variants={itemVariants}
                                exit={{ opacity: 0, x: -20 }}
                                className="border-b transition-colors duration-150 hover:bg-gold-accent/5"
                                style={{ borderColor: 'rgba(200, 169, 81, 0.1)' }}
                              >
                                <td className="px-4 py-3">
                                  <span
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold"
                                    style={{
                                      backgroundColor: 'rgba(200, 169, 81, 0.12)',
                                      color: '#C8A951',
                                    }}
                                  >
                                    {q.questionNumber}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p
                                    className="text-sm leading-snug line-clamp-2"
                                    style={{ color: '#063B2D' }}
                                  >
                                    {q.englishQuestion}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
                                      style={{
                                        backgroundColor: 'rgba(6, 59, 45, 0.1)',
                                        color: '#063B2D',
                                      }}
                                    >
                                      {q.correctOption}
                                    </span>
                                    <span
                                      className="text-xs"
                                      style={{ color: 'rgba(6, 59, 45, 0.6)' }}
                                    >
                                      {getCorrectText(q)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-medium"
                                    style={{
                                      borderColor: q.round === 1 ? 'rgba(6, 59, 45, 0.2)' : 'rgba(7, 26, 43, 0.3)',
                                      color: q.round === 1 ? '#063B2D' : '#071A2B',
                                    }}
                                  >
                                    R{q.round}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {q.isActive ? (
                                    <Badge
                                      className="text-xs font-medium"
                                      style={{
                                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                        color: '#16a34a',
                                        border: '1px solid rgba(34, 197, 94, 0.2)',
                                      }}
                                    >
                                      Active
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs font-medium"
                                    >
                                      Inactive
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditDialog(q)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Pencil className="w-3.5 h-3.5" style={{ color: '#C8A951' }} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteTarget(q)}
                                      className="h-8 w-8 p-0 hover:text-destructive"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Mobile: Card View */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="lg:hidden flex flex-col gap-3"
              >
                {filteredQuestions.map((q) => (
                  <motion.div
                    key={q.id}
                    variants={itemVariants}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold shrink-0"
                              style={{
                                backgroundColor: 'rgba(200, 169, 81, 0.12)',
                                color: '#C8A951',
                              }}
                            >
                              {q.questionNumber}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                                style={{
                                  borderColor: q.round === 1 ? 'rgba(6, 59, 45, 0.2)' : 'rgba(7, 26, 43, 0.3)',
                                  color: q.round === 1 ? '#063B2D' : '#071A2B',
                                }}
                              >
                                R{q.round}
                              </Badge>
                              {q.isActive ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                    color: '#16a34a',
                                  }}
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Active
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                    color: 'rgba(6, 59, 45, 0.5)',
                                  }}
                                >
                                  <XCircle className="w-2.5 h-2.5" />
                                  Inactive
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(q)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-3.5 h-3.5" style={{ color: '#C8A951' }} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(q)}
                              className="h-8 w-8 p-0 hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        <p
                          className="text-sm leading-snug mb-2 line-clamp-2"
                          style={{ color: '#063B2D' }}
                        >
                          {q.englishQuestion}
                        </p>

                        <div
                          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                          style={{
                            backgroundColor: 'rgba(200, 169, 81, 0.06)',
                          }}
                        >
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0"
                            style={{
                              backgroundColor: 'rgba(6, 59, 45, 0.1)',
                              color: '#063B2D',
                            }}
                          >
                            {q.correctOption}
                          </span>
                          <span
                            className="text-xs truncate"
                            style={{ color: 'rgba(6, 59, 45, 0.7)' }}
                          >
                            {getCorrectText(q)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>

              {/* No search results */}
              {filteredQuestions.length === 0 && searchQuery && (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: 'rgba(6, 59, 45, 0.5)' }}>
                    No questions match &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Question Form Dialog */}
      <QuestionFormDialog
        key={dialogOpen ? (editingQuestion?.id ?? 'new') : 'closed'}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingQuestion(null);
        }}
        initialData={
          editingQuestion
            ? {
                questionNumber: editingQuestion.questionNumber,
                englishQuestion: editingQuestion.englishQuestion,
                gujaratiQuestion: editingQuestion.gujaratiQuestion,
                optionAEnglish: editingQuestion.optionAEnglish,
                optionBEnglish: editingQuestion.optionBEnglish,
                optionCEnglish: editingQuestion.optionCEnglish,
                optionDEnglish: editingQuestion.optionDEnglish,
                optionAGujarati: editingQuestion.optionAGujarati,
                optionBGujarati: editingQuestion.optionBGujarati,
                optionCGujarati: editingQuestion.optionCGujarati,
                optionDGujarati: editingQuestion.optionDGujarati,
                correctOption: editingQuestion.correctOption,
                marks: editingQuestion.marks,
                round: editingQuestion.round,
                isActive: editingQuestion.isActive,
              }
            : null
        }
        onSubmit={handleFormSubmit}
        isLoading={isSaving}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question #{deleteTarget?.questionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the question
              from the database. Any existing attempts referencing this question will not
              be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
