---
name: Skeleton loading states
description: All data-fetching UI must show skeleton placeholders while loading, never spinners or blank content
type: feedback
---

Every page and component that fetches async data must render skeleton placeholders instead of a spinner or empty state. Skeletons should match the shape and dimensions of the real content (text lines, cards, table rows, avatars).

**Why:** User explicitly requested skeleton loading states app-wide as a UX standard.

**How to apply:**
- Replace `isLoading` spinner divs with skeleton shimmer elements that mirror the real layout
- Use a consistent `animate-pulse bg-muted rounded` Tailwind pattern for skeleton blocks
- Skeleton should appear immediately on mount; never show blank whitespace while loading
- Table rows, cards, leaderboard entries, nutrition logs — all need skeletons
