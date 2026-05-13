---
name: Content centering preference
description: All dashboard page content must be centered in the viewport container
type: feedback
---

All dashboard page content containers should be horizontally centered using `mx-auto` with a sensible `max-w-*`. Never use left-aligned layouts (e.g. bare `max-w-5xl` without `mx-auto`).

**Why:** User explicitly flagged that instructor wing page was left-aligned and said "I want all existing and future content to be centered in the container."

**How to apply:** Every new dashboard page wrapper `<div>` should use `mx-auto` alongside any `max-w-*` class. Apply this retroactively when editing existing pages too.
