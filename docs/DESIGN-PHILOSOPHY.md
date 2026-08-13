# Ordered Light

*The design philosophy governing the Islamic Quiz Competition interface.*

---

## The movement

**Ordered Light** treats sequence as the subject and restraint as the method.

This is an interface about putting things in their right order — surahs, years,
prophets. So the design refuses decoration and instead makes *position* the loudest
thing on the screen. A numeral in a gold square is not an ornament; it is the answer.
Every screen is a numbered column descending through space, and the eye reads it the
way one reads a manuscript: top to bottom, one certainty at a time.

The palette is fixed and small — the deep emerald of the school crest, a single warm
gold, and warm ivory on top. Three colours, and two more held in reserve that appear
only to deliver a verdict: emerald-bright for a sequence in its right place, a muted
red for one that is not. Colour is never mood. Colour is information. When gold
appears, something is placed. When green appears, something is true. A screen that
uses more colours than it has meanings is a screen that has stopped thinking, and
this one has not.

Type is drawn in two voices. Labels are small, wide-tracked, uppercase — the quiet
hand of a catalogue, whispering QUESTION 02 and YOUR SEQUENCE at the edge of
perception. Numbers are monospaced and tabular so that a running clock never jitters
a single pixel as it counts down; digits must sit in fixed columns, because a timer
that shifts is a timer nobody trusts. Between these two voices sits the content
itself, set plainly and large enough to be read at arm's length on a phone held in a
crowded hall. Nothing is centred that could be aligned. Nothing is bold that could be
placed well.

Space does the work that borders would otherwise do. A hairline rule, a two-pixel
gold spine down the left of a question, a single dashed outline marking an empty slot
waiting to be filled — these are the only enclosures permitted. The empty slots
matter enormously: the column shows its full height from the first moment, so the
layout never jumps as items land in it. A student under a countdown must never have
the ground move beneath their thumb. This is the kind of detail that takes hours to
get right and is invisible when it is right, which is precisely the standard being
held to here.

Motion is physics, never performance. Items settle into place with spring damping
tuned so the eye believes the weight; the leaderboard reorders by sliding rows past
one another so a student can *watch themselves overtake someone*, which is the entire
emotional payload of a live competition. The countdown is painted in step with the
display refresh rather than on a timer interval, because a stuttering clock reads as
a broken product no matter how correct the arithmetic underneath. Every animation
either communicates a state change or it does not ship.

The whole must appear meticulously crafted — the product of deep expertise and
painstaking attention, laboured over until nothing remains that could be removed.
Master-level execution here means the absence of incident: no orphaned element, no
misaligned baseline, no colour that arrived by accident, no motion that draws
attention to itself. When a hall of three hundred people looks up at the projected
board, they should feel that someone at the top of their field cared about this, and
should not be able to say exactly why.

---

## How it resolves

| Principle | In the build |
|---|---|
| Position is the loudest element | Monospaced numerals in filled chips; the ordinal is the hero |
| Colour carries meaning, never mood | Emerald + gold + ivory; green/red appear only at the verdict |
| The ground never moves | Empty slots hold full column height from the first frame |
| Clocks must not jitter | `tabular-nums`, fixed decimal places, `requestAnimationFrame` |
| Motion is physics | Spring damping on placement; layout animation on rank changes |
| Space over borders | Hairlines and a gold spine; almost no boxes |
| Two typographic voices | Wide-tracked uppercase labels; plain readable content |
| Nothing decorative survives | If an element doesn't carry state, it isn't there |

---

## The reserved gesture

One flourish is permitted, once per question: at the reveal, the correct sequence
enters as a stagger — each row arriving 70ms after the one above it, top to bottom,
so the right answer *assembles itself* in front of the room. It is the only moment in
the entire interface that exists purely for feeling, and it earns its place by being
the only one.
