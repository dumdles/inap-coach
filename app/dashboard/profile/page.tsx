'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/context/auth-context'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { AchievementBadge } from '@/components/achievements/achievement-badge'
import { ACHIEVEMENTS, type Achievement } from '@/lib/achievements'

function ProfileRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
    )
}

type AchievementWithUnlocked = Achievement & { unlocked: boolean }

const ACHIEVEMENT_CATEGORIES = [
    { id: 'nutrition',   label: 'Nutrition'       },
    { id: 'fitness',     label: 'Fitness'         },
    { id: 'ippt',        label: 'IPPT & Running'  },
    { id: 'sleep',       label: 'Sleep'           },
    { id: 'consistency', label: 'Consistency'     },
    { id: 'social',      label: 'Social'          },
    { id: 'progress',    label: 'Progress'        },
] as const

export default function ProfilePage() {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const meta = user?.user_metadata ?? {}
    const [profile, setProfile] = useState<Record<string, any> | null>(null)
    const [achievements, setAchievements] = useState<AchievementWithUnlocked[]>([])
    const [achievementsLoading, setAchievementsLoading] = useState(true)

    useEffect(() => {
      if (!user) return
      supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => setProfile(data))
    }, [user])

    useEffect(() => {
        if (!user) return
        fetch(`/api/achievements?userId=${user.id}`)
            .then(r => r.json())
            .then(data => setAchievements(Array.isArray(data) ? data : []))
            .finally(() => setAchievementsLoading(false))
    }, [user])

    const handleSignOut = async () => {
        await signOut()
        router.replace('/login')
    }

    return (
        <div className="max-w-2xl px-8 pt-10 pb-10 space-y-6">
            <div>
                <h1 className="font-display text-3xl font-extrabold text-foreground mb-1">Profile</h1>
                <p className="text-sm text-muted-foreground">Your account and fitness details.</p>
            </div>

            {/* Avatar + name */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-2xl font-extrabold font-display text-white shrink-0">
                    {(profile?.full_name ?? 'U')[0]}
                </div>
                <div>
                    <div className="font-display text-xl font-bold text-foreground">{profile?.full_name ?? '—'}</div>
                    <div className="text-sm text-muted-foreground">@{profile?.username} • Joined {profile?.created_at ? new Date(profile?.created_at).toLocaleDateString() : '—'}</div>
                </div>
            </div>

            {/* Account info */}
            <div className="bg-card border border-border rounded-2xl px-4">
                <ProfileRow label="Email" value={user?.email ?? '—'} />
                <ProfileRow label="Rank" value={profile?.rank ?? '—'} />
                <ProfileRow label="Wing" value={profile?.wing ?? '—'} />
            </div>

            {/* Fitness info */}
            <div className="bg-card border border-border rounded-2xl px-4">
                <ProfileRow label="Height" value={profile?.height_cm ? `${profile?.height_cm} cm` : '—'} />
                <ProfileRow label="Weight" value={profile?.weight_kg ? `${profile?.weight_kg} kg` : '—'} />
                <ProfileRow label="Gender" value={profile?.gender ?? '—'} />
                <ProfileRow label="Date of Birth" value={profile?.date_of_birth ? new Date(profile?.date_of_birth).toLocaleDateString() : '—'} />
                <ProfileRow label="Activity Level" value={profile?.activity_level ?? '—'} />
                <ProfileRow label="Goal Mode" value={profile?.goal_mode ?? '—'} />
            </div>

            {/* ── Achievements ────────────────────────────────────────── */}
            <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-semibold text-foreground">Achievements</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Badges earned on your fitness journey</p>
                    </div>
                    {!achievementsLoading && (
                        <span className="text-sm font-bold text-primary tabular-nums">
                            {achievements.filter(a => a.unlocked).length}
                            <span className="text-muted-foreground font-normal">/{achievements.length}</span>
                        </span>
                    )}
                </div>

                {achievementsLoading ? (
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-0.5">
                        {Array.from({ length: ACHIEVEMENTS.length }).map((_, i) => (
                            <div key={i} className="flex flex-col items-center gap-1.5 p-2">
                                <Skeleton className="w-11 h-11 rounded-xl" />
                                <Skeleton className="h-2 w-12 rounded" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {ACHIEVEMENT_CATEGORIES.map(cat => {
                            const catBadges = achievements.filter(a => a.category === cat.id)
                            if (catBadges.length === 0) return null
                            const unlocked = catBadges.filter(a => a.unlocked).length
                            return (
                                <div key={cat.id}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            {cat.label}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground tabular-nums">
                                            {unlocked}/{catBadges.length}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-0.5">
                                        {catBadges.map(a => (
                                            <AchievementBadge key={a.id} achievement={a} unlocked={a.unlocked} />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <Link href="/dashboard/settings" className="block">
                <Button variant="outline" size="lg" className="w-full">
                    Settings
                </Button>
            </Link>

            <Button variant="outline" size="lg" className="w-full text-danger border-danger/30 hover:bg-danger/10" onClick={handleSignOut}>
                Sign out
            </Button>
        </div>
    )
}
