// Supabase SQL — run once to enable achievement persistence:
//
// create table user_achievements (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references users(id) on delete cascade not null,
//   achievement_id text not null,
//   unlocked_at timestamptz not null default now(),
//   unique(user_id, achievement_id)
// );
// create index on user_achievements(user_id);

export type AchievementRarity   = 'common' | 'rare' | 'epic' | 'legendary'
export type AchievementCategory = 'nutrition' | 'fitness' | 'ippt' | 'sleep' | 'consistency' | 'social' | 'progress'

export interface Achievement {
    id:          string
    name:        string
    description: string
    icon:        string
    rarity:      AchievementRarity
    category:    AchievementCategory
}

// Higher number = rarer — used to pick the "best" badge to display per user.
export const RARITY_ORDER: Record<AchievementRarity, number> = {
    common: 1, rare: 2, epic: 3, legendary: 4,
}

export const ACHIEVEMENTS: Achievement[] = [

    // ── Nutrition (7) ─────────────────────────────────────────────────────────
    { id: 'first_meal',     name: 'First Bite',        description: 'Log your first meal',                              icon: '🍽️', rarity: 'common',    category: 'nutrition'   },
    { id: 'meal_streak_3',  name: 'On a Roll',          description: 'Log meals 3 days in a row',                        icon: '🥄', rarity: 'common',    category: 'nutrition'   },
    { id: 'meal_streak_7',  name: 'Mess Hall Regular',  description: 'Log meals 7 days in a row',                        icon: '⚡', rarity: 'rare',      category: 'nutrition'   },
    { id: 'triple_meals',   name: 'Three Square Meals', description: 'Log breakfast, lunch & dinner on the same day',    icon: '🥗', rarity: 'common',    category: 'nutrition'   },
    { id: 'meals_50',       name: 'Dedicated Eater',    description: 'Log 50 meals in total',                            icon: '🍱', rarity: 'rare',      category: 'nutrition'   },
    { id: 'meals_100',      name: 'Meal Tracker',       description: 'Log 100 meals in total',                           icon: '📊', rarity: 'epic',      category: 'nutrition'   },
    { id: 'meals_250',      name: 'Nutrition Nerd',     description: 'Log 250 meals in total',                           icon: '🧬', rarity: 'legendary', category: 'nutrition'   },

    // ── Fitness (10) ──────────────────────────────────────────────────────────
    { id: 'first_workout',  name: 'Fall In!',           description: 'Log your first workout',                           icon: '💪', rarity: 'common',    category: 'fitness'     },
    { id: 'workouts_5',     name: 'PT Session',         description: 'Complete 5 workouts',                              icon: '🏋️', rarity: 'common',    category: 'fitness'     },
    { id: 'workouts_20',    name: 'Sweat Session',      description: 'Complete 20 workouts',                             icon: '🏅', rarity: 'rare',      category: 'fitness'     },
    { id: 'workouts_50',    name: 'Fitness Machine',    description: 'Complete 50 workouts',                             icon: '🦁', rarity: 'epic',      category: 'fitness'     },
    { id: 'workouts_100',   name: 'Century Club',       description: 'Complete 100 workouts',                            icon: '💯', rarity: 'legendary', category: 'fitness'     },
    { id: 'calorie_500',    name: 'Calorie Crusher',    description: 'Burn 500+ kcal in a single session',               icon: '🔥', rarity: 'rare',      category: 'fitness'     },
    { id: 'calorie_1000',   name: 'Inferno',            description: 'Burn 1,000+ kcal in a single session',             icon: '🌋', rarity: 'epic',      category: 'fitness'     },
    { id: 'kcal_10k',       name: '10K Burned',         description: 'Burn 10,000 kcal total across all workouts',       icon: '⚗️', rarity: 'rare',      category: 'fitness'     },
    { id: 'kcal_50k',       name: 'Furnace',            description: 'Burn 50,000 kcal total across all workouts',       icon: '🏭', rarity: 'epic',      category: 'fitness'     },
    { id: 'polar_connected',name: 'Watch On',           description: 'Sync data from your Polar watch',                  icon: '⌚', rarity: 'common',    category: 'fitness'     },

    // ── IPPT & Running (6) ────────────────────────────────────────────────────
    { id: 'ippt_date_set',  name: 'Target Locked',      description: 'Set your IPPT date',                               icon: '📅', rarity: 'common',    category: 'ippt'        },
    { id: 'first_run',      name: 'First Step',         description: 'Log your first running workout',                   icon: '👟', rarity: 'common',    category: 'ippt'        },
    { id: 'run_5k',         name: '5K Cadet',           description: 'Complete a 5+ km run',                             icon: '🏃', rarity: 'rare',      category: 'ippt'        },
    { id: 'run_10k',        name: '10K Warrior',        description: 'Complete a 10+ km run',                            icon: '🎽', rarity: 'epic',      category: 'ippt'        },
    { id: 'run_21k',        name: 'Iron Legs',          description: 'Complete a half-marathon (21+ km)',                icon: '🦵', rarity: 'legendary', category: 'ippt'        },
    { id: 'runs_7_days',    name: 'Born to Run',        description: 'Log runs on 7 different days',                     icon: '🌄', rarity: 'rare',      category: 'ippt'        },

    // ── Sleep (8) ─────────────────────────────────────────────────────────────
    { id: 'first_sleep',    name: 'Lights Out',         description: 'Log your first sleep record',                      icon: '🌙', rarity: 'common',    category: 'sleep'       },
    { id: 'sleep_streak_7', name: 'Sleep Discipline',   description: 'Log sleep 7 nights in a row',                      icon: '😴', rarity: 'rare',      category: 'sleep'       },
    { id: 'sleep_streak_14',name: 'Fortnight Rest',     description: 'Log sleep 14 nights in a row',                     icon: '💤', rarity: 'epic',      category: 'sleep'       },
    { id: 'optimal_sleep_5',name: 'Recovery Pro',       description: 'Get 6–9 h sleep 5 nights running',                 icon: '⭐', rarity: 'rare',      category: 'sleep'       },
    { id: 'sleep_score_80', name: 'Deep Sleeper',       description: 'Achieve a Polar sleep score of 80+',               icon: '🌟', rarity: 'epic',      category: 'sleep'       },
    { id: 'sleep_score_90', name: 'Elite Sleep',        description: 'Achieve a Polar sleep score of 90+',               icon: '✨', rarity: 'legendary', category: 'sleep'       },
    { id: 'sleep_go',       name: 'Green Light',        description: 'Reach "Go" recovery readiness',                    icon: '🟢', rarity: 'rare',      category: 'sleep'       },
    { id: 'sleep_debt_free',name: 'Well Rested',        description: 'No sleep debt for 7 consecutive days',             icon: '🛌', rarity: 'epic',      category: 'sleep'       },

    // ── Consistency (6) ───────────────────────────────────────────────────────
    { id: 'habit_trifecta', name: 'Triple Threat',      description: 'Log a meal, workout & sleep on the same day',      icon: '🎯', rarity: 'rare',      category: 'consistency' },
    { id: 'perfect_week',   name: 'Perfect Week',       description: 'Log all 3 habits every day for 7 days',            icon: '🏆', rarity: 'epic',      category: 'consistency' },
    { id: 'perfect_fortnight', name: 'Perfect Fortnight', description: 'Log all 3 habits every day for 14 days',         icon: '👑', rarity: 'legendary', category: 'consistency' },
    { id: 'streak_14',      name: '2-Week Warrior',     description: 'Maintain a 14-day meal logging streak',            icon: '⚔️', rarity: 'rare',      category: 'consistency' },
    { id: 'streak_30',      name: 'Iron Cadet',         description: 'Maintain a 30-day meal logging streak',            icon: '🛡️', rarity: 'epic',      category: 'consistency' },
    { id: 'streak_60',      name: 'Sixty Strong',       description: 'Maintain a 60-day meal logging streak',            icon: '🔱', rarity: 'legendary', category: 'consistency' },

    // ── Social (4) ────────────────────────────────────────────────────────────
    { id: 'first_friend',   name: 'Battle Buddy',       description: 'Add your first friend',                            icon: '🤝', rarity: 'common',    category: 'social'      },
    { id: 'friends_5',      name: 'Squad Goals',        description: 'Have 5 friends',                                   icon: '👥', rarity: 'rare',      category: 'social'      },
    { id: 'top_3_wing',     name: 'Podium Finish',      description: 'Reach top 3 on the wing leaderboard',              icon: '🥉', rarity: 'epic',      category: 'social'      },
    { id: 'rank_1_wing',    name: 'Wing Commander',     description: 'Reach #1 on the wing leaderboard',                 icon: '🎖️', rarity: 'legendary', category: 'social'      },

    // ── Progress (9) ──────────────────────────────────────────────────────────
    { id: 'first_weight_log', name: 'First Weigh-In',  description: 'Log your first body weight',                        icon: '⚖️', rarity: 'common',    category: 'progress'    },
    { id: 'weight_logs_7',  name: 'Body Check',         description: 'Log your weight 7 times',                          icon: '📈', rarity: 'rare',      category: 'progress'    },
    { id: 'weight_logs_30', name: 'Scale Loyal',        description: 'Log your weight 30 times',                         icon: '📉', rarity: 'epic',      category: 'progress'    },
    { id: 'goal_setter',    name: 'Mission Briefed',    description: 'Set a weight goal',                                 icon: '📋', rarity: 'common',    category: 'progress'    },
    { id: 'goal_achiever',  name: 'Mission Complete',   description: 'Reach your target weight',                          icon: '✅', rarity: 'legendary', category: 'progress'    },
    { id: 'weight_lost_1kg',name: 'Cutting',            description: 'Lose 1+ kg from your first weigh-in',              icon: '🔻', rarity: 'rare',      category: 'progress'    },
    { id: 'weight_lost_5kg',name: 'Transformation',     description: 'Lose 5+ kg from your first weigh-in',              icon: '🦅', rarity: 'epic',      category: 'progress'    },
    { id: 'weight_gained_2kg', name: 'Bulk Season',     description: 'Gain 2+ kg from your first weigh-in',              icon: '🔺', rarity: 'rare',      category: 'progress'    },
    { id: 'weight_gained_5kg', name: 'Bulk Complete',   description: 'Gain 5+ kg from your first weigh-in',              icon: '🐂', rarity: 'epic',      category: 'progress'    },
]

export const ACHIEVEMENT_MAP: Record<string, Achievement> = Object.fromEntries(
    ACHIEVEMENTS.map(a => [a.id, a]),
)

// ── Input data required to compute achievements ────────────────────────────

export interface AchievementInput {
    // Nutrition
    totalMealLogs:           number
    mealStreak:              number  // current consecutive days with any meal logged
    daysWithAllMealTypes:    number  // days where breakfast + lunch + dinner all logged

    // Fitness
    totalWorkouts:           number
    maxSingleWorkoutKcal:    number
    totalKcalBurned:         number  // sum of all workout calories
    hasPolarSync:            boolean

    // IPPT & Running
    hasIpptDate:             boolean
    totalRuns:               number  // workouts with distance_km > 0
    maxRunDistanceKm:        number
    runDays:                 number  // distinct days with a run logged

    // Sleep
    totalSleepLogs:          number
    sleepStreak:             number  // current consecutive nights logged
    optimalSleepStreak:      number  // longest run of consecutive 6–9 h nights
    maxSleepScore:           number
    hasGoReadiness:          boolean // any night ever reached "Go" readiness
    sleepDebtFree7Days:      boolean // any 7-consecutive-night window with all nights ≥ 7 h

    // Consistency
    daysWithAllHabits:       number  // days with meal + workout + sleep logged
    perfectWeeks:            number  // ≥ 1 if any 7-day window had all habits every day
    perfectFortnight:        number  // ≥ 1 if any 14-day window had all habits every day

    // Social
    totalFriends:            number

    // Progress
    totalWeightLogs:         number
    hasWeightGoal:           boolean
    goalAchieved:            boolean
    weightChangeSinceStart:  number  // latestWeight − firstWeight (+= gained, −= lost)

    // Leaderboard position (optional — set by caller after leaderboard loads)
    leaderboardPosition?:    number
}

// Returns the IDs of every achievement the user has currently earned.
// Once persisted in user_achievements, a badge is never lost even if the
// underlying condition later drops below the threshold.
export function computeAchievements(input: AchievementInput): string[] {
    const unlocked: string[] = []
    const check = (id: string, cond: boolean) => { if (cond) unlocked.push(id) }

    // Nutrition
    check('first_meal',       input.totalMealLogs >= 1)
    check('meal_streak_3',    input.mealStreak >= 3)
    check('meal_streak_7',    input.mealStreak >= 7)
    check('triple_meals',     input.daysWithAllMealTypes >= 1)
    check('meals_50',         input.totalMealLogs >= 50)
    check('meals_100',        input.totalMealLogs >= 100)
    check('meals_250',        input.totalMealLogs >= 250)

    // Fitness
    check('first_workout',    input.totalWorkouts >= 1)
    check('workouts_5',       input.totalWorkouts >= 5)
    check('workouts_20',      input.totalWorkouts >= 20)
    check('workouts_50',      input.totalWorkouts >= 50)
    check('workouts_100',     input.totalWorkouts >= 100)
    check('calorie_500',      input.maxSingleWorkoutKcal >= 500)
    check('calorie_1000',     input.maxSingleWorkoutKcal >= 1000)
    check('kcal_10k',         input.totalKcalBurned >= 10_000)
    check('kcal_50k',         input.totalKcalBurned >= 50_000)
    check('polar_connected',  input.hasPolarSync)

    // IPPT & Running
    check('ippt_date_set',    input.hasIpptDate)
    check('first_run',        input.totalRuns >= 1)
    check('run_5k',           input.maxRunDistanceKm >= 5)
    check('run_10k',          input.maxRunDistanceKm >= 10)
    check('run_21k',          input.maxRunDistanceKm >= 21)
    check('runs_7_days',      input.runDays >= 7)

    // Sleep
    check('first_sleep',      input.totalSleepLogs >= 1)
    check('sleep_streak_7',   input.sleepStreak >= 7)
    check('sleep_streak_14',  input.sleepStreak >= 14)
    check('optimal_sleep_5',  input.optimalSleepStreak >= 5)
    check('sleep_score_80',   input.maxSleepScore >= 80)
    check('sleep_score_90',   input.maxSleepScore >= 90)
    check('sleep_go',         input.hasGoReadiness)
    check('sleep_debt_free',  input.sleepDebtFree7Days)

    // Consistency
    check('habit_trifecta',   input.daysWithAllHabits >= 1)
    check('perfect_week',     input.perfectWeeks >= 1)
    check('perfect_fortnight',input.perfectFortnight >= 1)
    check('streak_14',        input.mealStreak >= 14)
    check('streak_30',        input.mealStreak >= 30)
    check('streak_60',        input.mealStreak >= 60)

    // Social
    check('first_friend',     input.totalFriends >= 1)
    check('friends_5',        input.totalFriends >= 5)
    if (input.leaderboardPosition != null) {
        check('top_3_wing',   input.leaderboardPosition <= 3)
        check('rank_1_wing',  input.leaderboardPosition === 1)
    }

    // Progress
    check('first_weight_log', input.totalWeightLogs >= 1)
    check('weight_logs_7',    input.totalWeightLogs >= 7)
    check('weight_logs_30',   input.totalWeightLogs >= 30)
    check('goal_setter',      input.hasWeightGoal)
    check('goal_achiever',    input.goalAchieved)
    check('weight_lost_1kg',  input.weightChangeSinceStart <= -1)
    check('weight_lost_5kg',  input.weightChangeSinceStart <= -5)
    check('weight_gained_2kg',input.weightChangeSinceStart >= 2)
    check('weight_gained_5kg',input.weightChangeSinceStart >= 5)

    return unlocked
}
