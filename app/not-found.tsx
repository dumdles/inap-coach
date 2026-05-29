import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
            {/* Large 404 */}
            <p className="font-display font-extrabold text-[120px] sm:text-[160px] leading-none tracking-tight text-foreground select-none"
                style={{ opacity: 0.06 }}>
                404
            </p>

            {/* Content — overlaid on top with negative margin */}
            <div className="text-center -mt-12 sm:-mt-16 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Page not found</span>
                </div>

                <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-foreground tracking-tight">
                    You&apos;re off the map, cadet.
                </h1>

                <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    This page doesn&apos;t exist or has been moved. Fall back to the dashboard and resume your mission.
                </p>

                <div className="flex items-center justify-center gap-3 pt-2">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                    >
                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Go to Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                        Home
                    </Link>
                </div>
            </div>
        </div>
    )
}
