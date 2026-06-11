'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/context/auth-context'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { wingToService, SERVICE_META } from '@/lib/service'
import { cn } from '@/lib/utils'

function ProfileRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
    )
}

export default function ProfilePage() {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const meta = user?.user_metadata ?? {}
    const [profile, setProfile] = useState<Record<string, any> | null>(null)

    useEffect(() => {                                               
      if (!user) return                  
      supabase                                                                     
          .from('users')
          .select('*')                                                             
          .eq('id', user.id)                                      
          .single()                      
          .then(({ data }) => setProfile(data))
  }, [user])

    const handleSignOut = async () => {
        await signOut()
        router.replace('/login')
    }

    const service = profile?.wing ? wingToService(profile.wing) : null
    const serviceMeta = service ? SERVICE_META[service] : null

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
                <div className="flex-1">
                    <div className="font-display text-xl font-bold text-foreground">{profile?.full_name ?? '—'}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">@{profile?.username} • Joined {profile?.created_at ? new Date(profile?.created_at).toLocaleDateString() : '—'}</span>
                        {serviceMeta && (
                            <span className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                                serviceMeta.bg, serviceMeta.text, serviceMeta.border,
                            )}>
                                <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>
                                {serviceMeta.label}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Account info */}
            <div className="bg-card border border-border rounded-2xl px-4">
                <ProfileRow label="Email" value={user?.email ?? '—'} />
                <ProfileRow label="Rank" value={profile?.rank ?? '—'} />
                <ProfileRow label="Wing" value={profile?.wing ?? '—'} />
                <ProfileRow label="Service" value={service ?? '—'} />
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
