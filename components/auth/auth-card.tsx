import React from 'react'

/** Card shell shared by the sign-in style pages (forgot / reset password). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto p-8 bg-card rounded-2xl border border-border shadow-lg animate-fade-in">
                <div className="mb-8">
                    <div className="font-display text-4xl font-extrabold tracking-tight text-foreground mb-6">FitRep</div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
                    <p className="text-muted-foreground">{subtitle}</p>
                </div>
                {children}
            </div>
        </div>
    )
}
