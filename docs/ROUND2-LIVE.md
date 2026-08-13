# Round 2 — Live Mode

One question at a time, released by the quiz master. Between questions the
leaderboard updates, then the next question opens.

---

## The three screens

| Screen | URL | Who opens it |
|---|---|---|
| Control panel | `/admin/round2` | Quiz master — this is the screen you project on the board |
| Projector board | `/round2/display` | Optional second screen: big question + live leaderboard, no controls |
| Student page | `/round2` | Students, on their phones |

The control panel and the board can both be open at once. The control panel
shows response counts and the answer key; the board never shows the answer
until you reveal it, so it is safe to project.

---

## Running a round

```
Open Q1  →  watch answers arrive  →  Lock  →  Reveal  →  Next Q  →  …
```

1. **Open** — the question appears on every student phone and the countdown starts.
2. Watch the **Responses** panel. It shows how many have answered, the A/B/C/D
   spread, and the names you are still waiting on.
3. **Lock** — answers close. The correct option is still hidden, so you can
   build suspense before revealing.
4. **Reveal** — the correct answer appears everywhere and the leaderboard
   updates to include this question.
5. **Next Q** — moves to the next question and opens it in one click.

`Reveal` also works straight from `open` (it locks first automatically), so a
two-click cycle of **Open → Reveal → Next** works if you prefer to move fast.

**Previous** steps back a question in the `revealed` state — it does not reopen
answering, so nobody gets a second attempt.

**Reset Round** deletes every Round 2 answer and returns to idle. Use it
between a rehearsal and the real event.

---

## Scoring

- Correct answer = the question's marks (1 by default). Wrong answer = 0.
- Ties are broken by **cumulative response time**, fastest first.
- Response time is measured on the server from the moment you pressed Open.
- A question a student did not answer is charged the **full question window**,
  not zero. Without this, staying silent would shrink a student's total time
  and improve their tiebreak position.

Rank 1 is therefore: most marks, and among those, fastest overall.

---

## Why the results hold up

| Concern | How it is handled |
|---|---|
| Reading the answer from network traffic | `correctOption` is never sent to a browser until you press Reveal. |
| Faking a fast time by changing the device clock | Response time is `serverNow − questionOpenedAt`, computed server-side. The client clock is used only to draw the countdown. |
| Answering twice / changing an answer | A unique database index on `(participantId, questionId)` makes a second row impossible. A double-tap returns the original answer. |
| Answering after time is up | The server re-checks the window (plus 1.5s grace for slow connections) and rejects late submissions. |
| A stale tab answering an old question | The submitted `questionId` must match the question currently open. |
| Reading the answer key from the admin API | `/api/admin/questions` and `/api/round2/live/stats` require a signed admin token. |
| Forging an admin token | Tokens are HMAC-signed with `JWT_SECRET` and expire after 12 hours. |
| Telling the room "I got it right" mid-question | Correctness is withheld from the student until the reveal. |

---

## Loading your questions

Round 2 questions are regular questions with `round: 2`. Three ways in:

**1. Admin → Questions** — the existing form, with Round set to 2.

**2. Bulk paste** — POST to `/api/admin/questions/bulk` with your admin token:

```json
{
  "round": 2,
  "replace": true,
  "text": "1. How many Surahs are in the Quran?\t110\t114\t120\t104\tB\n2. Which night is Laylat al-Qadr?\tJourney\tForgiveness\tPower\tMercy\tC"
}
```

Columns, separated by TAB or `|`:

```
question | optionA | optionB | optionC | optionD | correctLetter [| marks]
```

A leading `1.` or `1)` on the question sets the question number. Copy-paste
straight out of Excel or Google Sheets works, since spreadsheets copy as
tab-separated text.

**3. JSON array** — same endpoint, `questions: [...]` instead of `text`.

`replace: true` clears the round's existing questions first, which is what you
want when re-uploading a corrected sheet.

Gujarati fields are optional. When omitted, the English text is used for both
languages so nothing renders blank.

---

## Before the event

- [ ] Load the real questions and delete the placeholder set
- [ ] Set seconds-per-question in the control panel
- [ ] Change the admin password from `admin123`
- [ ] Run a rehearsal with 2–3 phones, then **Reset Round**
- [ ] Confirm `JWT_SECRET` is set in Vercel (admin auth depends on it)
- [ ] Open `/round2/display` on the projector before students join
