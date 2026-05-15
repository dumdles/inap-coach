# INAP Coach — Scoring System

All constants live in `lib/scoring.ts`. The leaderboard is computed in `app/api/leaderboard/route.ts`.

---

## Points per day

For each calendar day within the leaderboard period, a user earns:

| Activity | Points |
|---|---|
| Each meal logged (max 3/day) | **40 pts** |
| Every 10 kcal burned via workouts (capped at 1,000 kcal/day) | **1 pt** |

**Workout cap:** 1,000 kcal/day → max **100 workout pts/day**. This prevents outliers (e.g. a single ultra-endurance session) from distorting the leaderboard.

### Consistency multiplier

If a user logs **at least one meal AND at least one workout** on the same day, that day's total points (meals + workout) are multiplied by **1.5×**.

**Example — active day:**
- 3 meals = 120 pts
- 450 kcal burned = 45 pts
- Sub-total = 165 pts
- Consistency multiplier applied → **248 pts** (rounded)

**Example — meal-only day:**
- 3 meals = 120 pts
- No workout → no multiplier → **120 pts**

---

## Streak bonus

A streak is the number of consecutive days (counting back from today) on which **at least one meal** was logged. Streak is computed over the trailing 365 days.

| | |
|---|---|
| Bonus per streak day | **5 pts** |

The streak bonus is added on top of the period score and is not multiplied.

---

## Leaderboard periods

- **Week** — rolling 7-day window (last 6 days + today)
- **Month** — calendar month to date

Scopes: **Wing** (same wing as the viewer) or **Friends** (accepted friendships only).

---

## Summary formula

```
daily_pts(day) = (meal_pts + workout_pts) × (1.5 if consistency else 1)
period_score   = Σ daily_pts(day) for each day in period
total_score    = period_score + (streak_days × 5)
```

---

## Constants reference

```ts
PTS_PER_MEAL            = 40
MAX_MEALS_PER_DAY       = 3
STREAK_BONUS_PER_DAY    = 5
PTS_PER_10_KCAL         = 1
MAX_WORKOUT_KCAL_PER_DAY = 1000
CONSISTENCY_MULTIPLIER  = 1.5
```
