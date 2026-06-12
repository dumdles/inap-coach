// Shimmer text (transitions.dev) — a moving highlight band sweeps across the
// text while it sits in the muted color. Used for "generating…" states.
// Pure CSS: the styles live in app/globals.css (.t-shimmer). The data-text
// attribute duplicates the string into the masked ::before layer — they must
// stay in sync, hence children is a plain string.
export function Shimmer({ children, className }: { children: string; className?: string }) {
    return (
        <span className={`t-shimmer${className ? ` ${className}` : ''}`} data-text={children}>
            {children}
        </span>
    )
}
