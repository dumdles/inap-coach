---
name: Goal-mode dynamic colour theming
description: Primary UI colour changes app-wide based on the user's selected goal mode
type: feedback
---

The app's primary accent colour must reflect the user's goal mode, applied globally.

## Exact colour tokens (from design files — authoritative)

| Goal mode | Light primary | Dark primary | Light bg    | Label    |
|-----------|---------------|--------------|-------------|----------|
| Bulk      | `#0052CC`     | `#4C9AFF`    | `#DEEBFF`   | Bulk     |
| Cut       | `#DE350B`     | `#FF5630`    | `#FFEBE6`   | Cut      |
| Maintain  | `#00875A`     | `#36B37E`    | `#E3FCEF`   | Maintain |
| IPPT      | `#FF991F`     | `#FFAB00`    | `#FFFAE6`   | IPPT     |

**Why:** User wants the app to feel personalised to their training goal. Applies everywhere `--primary` is used — buttons, progress bars, rank card, active nav items, badges, streaks, etc.

**How to apply:**
- Goal mode stored in `users.goal_mode` (`bulk | maintain | cut | ippt`)
- Load goal mode in `theme-context.tsx` alongside dark/light — add it to the context value
- Inject a class on `<html>` (e.g. `goal-cut`, `goal-maintain`) that overrides CSS variables
- Define in `globals.css`:
  ```css
  .goal-bulk     { --primary: #0052CC; --primary-light: #DEEBFF; --primary-dark: #003A8C; }
  .goal-cut      { --primary: #DE350B; --primary-light: #FFEBE6; --primary-dark: #BF2600; }
  .goal-maintain { --primary: #00875A; --primary-light: #E3FCEF; --primary-dark: #006644; }
  .goal-ippt     { --primary: #FF991F; --primary-light: #FFFAE6; --primary-dark: #974F0C; }
  .dark.goal-bulk     { --primary: #4C9AFF; }
  .dark.goal-cut      { --primary: #FF5630; }
  .dark.goal-maintain { --primary: #36B37E; }
  .dark.goal-ippt     { --primary: #FFAB00; }
  ```
- Settings → Goal tab change must immediately re-theme (update context + class on `<html>`)
- Default is `bulk` (matches existing `#0052CC`)
