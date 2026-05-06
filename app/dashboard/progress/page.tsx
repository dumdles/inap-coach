export default function ProgressPage() {
    return (
        <div className="max-w-2xl px-8 pt-10 pb-10">
            <h1 className="font-display text-3xl font-extrabold text-foreground mb-1">Progress</h1>
            <p className="text-sm text-muted-foreground mb-8">Charts and trends over time.</p>
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                </div>
                <p className="font-semibold text-foreground">Progress charts coming soon</p>
                <p className="text-xs text-muted-foreground max-w-xs">View your weight, body composition, and fitness trends over time.</p>
            </div>
        </div>
    )
}
