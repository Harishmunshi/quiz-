'use client';

import { useMemo } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { GripVertical, Plus, X } from 'lucide-react';
import type { OrderItem } from '@/lib/round2/live';

/**
 * The sequence builder.
 *
 * Tap is the primary interaction, not drag. On a phone, dragging twelve items
 * into position fights the page scroll and costs students time to mis-drops —
 * so items are *tapped* from the pool into the answer, where they stack up
 * numbered 1, 2, 3… Tapping one in the answer sends it back. Drag is kept for
 * fine reordering once the rough sequence is down, with a hold-to-start delay
 * so a scroll gesture is never mistaken for a drag.
 */

interface Props {
  items: OrderItem[];
  /** Item keys, in the order the student has placed them. */
  placed: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Set after the reveal: the correct sequence, for diffing. */
  correctOrder?: string[] | null;
}

function secondaryLabel(item: OrderItem): string | null {
  return item.gu ?? item.hi ?? null;
}

export default function SequenceBuilder({
  items,
  placed,
  onChange,
  disabled = false,
  correctOrder = null,
}: Props) {
  const byKey = useMemo(
    () => Object.fromEntries(items.map((i) => [i.key, i])) as Record<string, OrderItem>,
    [items]
  );
  const pool = useMemo(
    () => items.filter((i) => !placed.includes(i.key)),
    [items, placed]
  );

  const sensors = useSensors(
    // A short hold before a drag begins, so vertical scrolling still works.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = placed.indexOf(String(active.id));
    const to = placed.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(arrayMove(placed, from, to));
  };

  const place = (key: string) => {
    if (disabled || placed.includes(key)) return;
    onChange([...placed, key]);
  };

  const remove = (key: string) => {
    if (disabled) return;
    onChange(placed.filter((k) => k !== key));
  };

  return (
    <div className="space-y-6">
      {/* ── Answer column ──────────────────────────────────────────── */}
      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A951]">
            Your sequence
          </h3>
          <span className="font-mono text-xs tabular-nums text-[#F7F2E7]/45">
            {placed.length} / {items.length}
          </span>
        </header>

        <div className="space-y-1.5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={placed} strategy={verticalListSortingStrategy}>
              <AnimatePresence initial={false}>
                {placed.map((key, index) => (
                  <SortableRow
                    key={key}
                    id={key}
                    index={index}
                    item={byKey[key]}
                    disabled={disabled}
                    onRemove={() => remove(key)}
                    verdict={
                      correctOrder
                        ? correctOrder[index] === key
                          ? 'right'
                          : 'wrong'
                        : null
                    }
                  />
                ))}
              </AnimatePresence>
            </SortableContext>
          </DndContext>

          {/* Empty slots keep the column's full height visible from the start,
              so the list doesn't jump as items land. */}
          {Array.from({ length: items.length - placed.length }).map((_, i) => (
            <div
              key={`slot-${i}`}
              className="flex h-[52px] items-center gap-3 rounded-xl border border-dashed border-white/10 px-3"
            >
              <span className="w-7 text-center font-mono text-sm tabular-nums text-[#F7F2E7]/20">
                {placed.length + i + 1}
              </span>
              <span className="text-sm text-[#F7F2E7]/20">—</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pool ───────────────────────────────────────────────────── */}
      {!disabled && (
        <section>
          <header className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#F7F2E7]/45">
              Tap to place
            </h3>
            <span className="font-mono text-xs tabular-nums text-[#F7F2E7]/30">
              {pool.length} left
            </span>
          </header>

          <div className="flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {pool.map((item) => (
                <motion.button
                  key={item.key}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  onClick={() => place(item.key)}
                  className="group flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-left transition-colors active:scale-[0.97] hover:border-[#C8A951]/50 hover:bg-[#C8A951]/10"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-[#C8A951]/50 transition-colors group-hover:text-[#C8A951]" />
                  <span className="leading-tight">
                    <span className="block text-sm font-medium text-[#F7F2E7]">
                      {item.en}
                    </span>
                    {secondaryLabel(item) && (
                      <span className="block text-[11px] text-[#F7F2E7]/45">
                        {secondaryLabel(item)}
                      </span>
                    )}
                  </span>
                  {item.ar && (
                    <span className="shrink-0 pl-1 text-sm text-[#C8A951]/70" dir="rtl">
                      {item.ar}
                    </span>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
}

// ── One placed row ─────────────────────────────────────────────────────

function SortableRow({
  id,
  index,
  item,
  disabled,
  onRemove,
  verdict,
}: {
  id: string;
  index: number;
  item?: OrderItem;
  disabled: boolean;
  onRemove: () => void;
  verdict: 'right' | 'wrong' | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  if (!item) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  const border =
    verdict === 'right'
      ? 'border-emerald-400/60 bg-emerald-400/[0.09]'
      : verdict === 'wrong'
        ? 'border-red-400/45 bg-red-400/[0.07]'
        : isDragging
          ? 'border-[#C8A951] bg-[#C8A951]/15'
          : 'border-[#C8A951]/25 bg-white/[0.06]';

  const numberChip =
    verdict === 'right'
      ? 'bg-emerald-400 text-[#063B2D]'
      : verdict === 'wrong'
        ? 'bg-red-400/80 text-[#3B0606]'
        : 'bg-[#C8A951] text-[#063B2D]';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
      className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 ${border} ${
        isDragging ? 'shadow-lg shadow-black/30' : ''
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums ${numberChip}`}
      >
        {index + 1}
      </span>

      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium text-[#F7F2E7]">
          {item.en}
        </span>
        {secondaryLabel(item) && (
          <span className="block truncate text-[11px] text-[#F7F2E7]/45">
            {secondaryLabel(item)}
          </span>
        )}
      </span>

      {item.ar && (
        <span className="shrink-0 text-sm text-[#C8A951]/70" dir="rtl">
          {item.ar}
        </span>
      )}

      {!disabled && (
        <>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.en}`}
            className="shrink-0 rounded-lg p-1.5 text-[#F7F2E7]/35 transition-colors hover:bg-white/10 hover:text-[#F7F2E7]"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Reorder ${item.en}`}
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none rounded-lg p-1.5 text-[#F7F2E7]/30 transition-colors hover:text-[#C8A951] active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </>
      )}
    </motion.div>
  );
}
