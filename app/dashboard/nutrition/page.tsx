export default function NutritionPage() {
    return (
        <div className="max-w-2xl px-8 pt-10 pb-10">
            <h1 className="font-display text-3xl font-extrabold text-foreground mb-1">Nutrition</h1>
            <p className="text-sm text-muted-foreground mb-8">Track your daily calories and macros.</p>
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
                    </svg>
                </div>
                <p className="font-semibold text-foreground">Meal logging coming soon</p>
                <p className="text-xs text-muted-foreground max-w-xs">Log meals, track macros, and hit your calorie targets every day.</p>
            </div>
        </div>
    )
}
