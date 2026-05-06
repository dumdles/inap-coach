export default function WorkoutsPage() {
    return (
        <div className="max-w-2xl px-8 pt-10 pb-10">
            <h1 className="font-display text-3xl font-extrabold text-foreground mb-1">Workouts</h1>
            <p className="text-sm text-muted-foreground mb-8">Log sessions and follow training plans.</p>
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 6.5v11M18 6.5v11" />
                    </svg>
                </div>
                <p className="font-semibold text-foreground">Workout logging coming soon</p>
                <p className="text-xs text-muted-foreground max-w-xs">Log your training sessions and follow personalised workout plans.</p>
            </div>
        </div>
    )
}
