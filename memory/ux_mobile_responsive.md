---
name: Mobile responsiveness and Liquid Glass bottom bar
description: App must be fully responsive with a floating Liquid Glass bottom nav bar on mobile
type: feedback
---

All pages must be responsive for smaller screens and mobile devices.

**Mobile navigation:** Replace the sidebar with a floating bottom bar on mobile (breakpoint: below `md`). Style should follow Apple Liquid Glass aesthetic — frosted glass background (`backdrop-blur`, semi-transparent), rounded pill or full-width bar floating above the OS navigation area.

**OS integration:** Use `safe-area-inset-*` CSS env variables so the bottom bar clears the iOS home indicator / Android gesture bar. The page background colour should extend into the OS notification shade (`theme-color` meta tag, matched to the app's current background).

**Layout:** On mobile, pages should be single-column, full-width with adequate horizontal padding (`px-4`). No fixed-width containers that cause overflow.

**Why:** User explicitly requested mobile responsiveness with a Liquid Glass floating bottom bar and OS-blending background as an app-wide standard.

**How to apply:**
- Sidebar in `dashboard/layout.tsx` should be hidden on mobile (`hidden md:flex`); show bottom bar instead
- Bottom bar shows the same nav items (Home, Nutrition, Workouts, Progress, Leaderboard) as icon+label
- Add `<meta name="theme-color">` in the root layout, dynamically matched to the app background
- Use `env(safe-area-inset-bottom)` padding on the bottom bar
- Every new page wrapper uses responsive classes: `px-4 md:px-8`, `max-w-5xl mx-auto`
