# INAP Coach — Design System v1.0

---

## Table of contents

1. [Colors](#colors)
2. [Typography](#typography)
3. [Spacing](#spacing)
4. [Buttons](#buttons)
5. [Forms](#forms)
6. [Cards](#cards)
7. [Badges & tags](#badges--tags)
8. [Navigation](#navigation)
9. [Tables](#tables)
10. [Alerts & toasts](#alerts--toasts)

---

## Colors

All colors are defined as CSS custom properties. Never hardcode hex values in components — always reference the token.

### Brand colors

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#0052CC` | Primary interactive colour, CTAs |
| `--primary-light` | `#DEEBFF` | Tinted backgrounds, secondary button fill |
| `--primary-dark` | `#003A8C` | Hover state on primary |
| `--primary-mid` | `#2684FF` | Toast action links |
| `--success` | `#00875A` | Positive states, protein on-track |
| `--success-light` | `#E3FCEF` | Success backgrounds |
| `--success-dark` | `#006644` | Success hover / text on light bg |
| `--warning` | `#FF991F` | Warning states |
| `--warning-light` | `#FFFAE6` | Warning backgrounds |
| `--warning-dark` | `#974F0C` | Warning text on light bg |
| `--danger` | `#DE350B` | Error / destructive states |
| `--danger-light` | `#FFEBE6` | Error backgrounds |
| `--danger-dark` | `#BF2600` | Error hover / text on light bg |

### Neutral scale

| Token | Hex |
|---|---|
| `--gray-0` | `#FFFFFF` |
| `--gray-50` | `#F5F7FA` |
| `--gray-100` | `#EBECF0` |
| `--gray-200` | `#DFE1E6` |
| `--gray-300` | `#C1C7D0` |
| `--gray-400` | `#A5ADBA` |
| `--gray-500` | `#6B778C` |
| `--gray-600` | `#505F79` |
| `--gray-700` | `#344563` |
| `--gray-800` | `#172B4D` |
| `--gray-900` | `#091E42` |

### Usage rules

| Role | Token |
|---|---|
| Page background | `--gray-50` |
| Card / surface | `--gray-0` (white) |
| Primary text | `--gray-800` |
| Secondary text | `--gray-500` |
| Disabled text | `--gray-300` |
| Default border | `--gray-200` |
| Hover border | `--gray-400` |
| Focus ring | `--primary` at 30% opacity, 3px spread |
| Interactive accent | `--primary` |

---

## Typography

Two fonts: **Satoshi** for headings and display numbers (geometric grotesque, clean and legible), **DM Sans** for all body text (clean, readable).

```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
```

### CSS tokens

```css
--font-display: 'Satoshi', sans-serif;
--font-body:    'DM Sans', sans-serif;
```

### Type scale

| Style | Font | Size | Weight | Letter-spacing | Line-height | Usage |
|---|---|---|---|---|---|---|
| Display XL | Satoshi | 40px | 800 | −0.03em | 1.1 | Large numbers (e.g. `2,184 kcal`) |
| Display LG | Satoshi | 32px | 700 | −0.025em | 1.15 | Page / section titles |
| Display MD | Satoshi | 24px | 600 | −0.02em | 1.2 | Card headings |
| Heading | Satoshi | 20px | 600 | −0.01em | 1.3 | Sub-section headings |
| Subheading | DM Sans | 17px | 500 | — | 1.4 | Supporting headings |
| Body | DM Sans | 15px | 400 | — | 1.6 | Default body copy |
| Body SM | DM Sans | 13px | 400 | — | 1.5 | Meta text, timestamps |
| Caption | DM Sans | 12px | 400 | — | 1.4 | Fine print, footnotes |
| Label / overline | DM Sans | 11px | 500 | 0.08em | — | Uppercase section labels |
| Stat number | Satoshi | 36px | 700 | −0.02em | 1 | Dashboard stat values |

---

## Spacing

4px base unit. All spacing uses multiples of 4. Use tokens — never arbitrary pixel values.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Micro gap |
| `--space-2` | 8px | Icon–label gap |
| `--space-3` | 12px | Input padding |
| `--space-4` | 16px | Card inner gap |
| `--space-5` | 20px | Card padding |
| `--space-6` | 24px | Section gap |
| `--space-8` | 32px | Large section gap |
| `--space-10` | 40px | Page gutter (mobile) |
| `--space-12` | 48px | Section header margin |
| `--space-16` | 64px | Page section spacing |

### Border radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Badges, checkboxes |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards |
| `--radius-xl` | 16px | Bottom nav, modals |
| `--radius-2xl` | 24px | Large panels |
| `--radius-full` | 9999px | Pills, tags, avatars |

### Shadows

```css
--shadow-sm: 0 1px 3px rgba(9,30,66,0.08), 0 0 1px rgba(9,30,66,0.08);
--shadow-md: 0 3px 8px rgba(9,30,66,0.12), 0 0 1px rgba(9,30,66,0.08);
--shadow-lg: 0 8px 24px rgba(9,30,66,0.12), 0 0 1px rgba(9,30,66,0.08);
```

### Transitions

```css
--transition:      150ms ease;   /* buttons, inputs */
--transition-slow: 250ms ease;   /* card hover shadow */
```

---

## Buttons

Minimum touch target: 44×44px on mobile. Always include hover and focus states.

### Variants

| Variant | Background | Text | Border | Hover background |
|---|---|---|---|---|
| Primary | `--primary` | white | — | `--primary-dark` |
| Secondary | `--primary-light` | `--primary` | `--primary-light` | `#C0D5F0` |
| Outline | transparent | `--primary` | `--gray-300` | `--primary-light` |
| Ghost | transparent | `--gray-600` | — | `--gray-100` |
| Danger | `--danger` | white | — | `--danger-dark` |
| Success | `--success` | white | — | `--success-dark` |

Disabled state: `opacity: 0.45; cursor: not-allowed; pointer-events: none`

### Sizes

| Size | Font | Padding |
|---|---|---|
| Small (sm) | 12px | 6px 12px |
| Medium (md) | 14px | 9px 16px |
| Large (lg) | 15px | 12px 22px |
| Extra large (xl) | 16px | 14px 28px |

### Specs (medium)

| Property | Value |
|---|---|
| Font | DM Sans 500 · 14px |
| Padding | 9px 16px |
| Border radius | `--radius-md` (8px) |
| Border width | 1.5px |
| Transition | 150ms ease |
| Focus ring | `0 0 0 3px rgba(0,82,204,0.3)` |

---

## Forms

All inputs share a 40px height, 1.5px border, 8px radius. Consistent focus state across every input type.

### Input specs

| Property | Value |
|---|---|
| Height | 40px |
| Padding | 0 12px |
| Border (default) | 1.5px solid `--gray-300` |
| Border (hover) | 1.5px solid `--gray-400` |
| Border (focus) | 1.5px solid `--primary` |
| Focus shadow | `0 0 0 3px rgba(0,82,204,0.12)` |
| Border (error) | 1.5px solid `--danger` |
| Error focus shadow | `0 0 0 3px rgba(222,53,11,0.12)` |
| Border (success) | 1.5px solid `--success` |
| Font | DM Sans 400 · 14px |
| Placeholder color | `--gray-400` |
| Disabled background | `--gray-100` |
| Border radius | `--radius-md` (8px) |

### Input types

- **Text / number** — standard 40px height
- **Select** — chevron icon injected via `background-image`; 36px right padding
- **Textarea** — auto height; `resize: vertical`; `padding: 12px`
- **Prefix/suffix inputs** — icon or unit overlaid absolutely; `has-prefix` adds 36px left padding, `has-suffix` adds 40px right padding

### Labels & helpers

- **Label** — DM Sans 500 · 13px · `--gray-700` · 8px gap below to input
- **Required marker** — `--danger` asterisk immediately after label text
- **Hint text** — DM Sans 400 · 12px · `--gray-400` · 4px below input
- **Error text** — DM Sans 400 · 12px · `--danger` · 4px below input

### Checkbox

- Size: 18×18px · border: 1.5px solid `--gray-300` · `--radius-sm`
- Checked: background `--primary`, border `--primary`, white checkmark (10×6px, −45° rotated)
- Always pair with label text; align checkbox to top of multiline labels

---

## Cards

White surface, 1px border, 12px radius. Cards never have colored backgrounds — color lives inside through badges, progress bars, and numbers.

### Base card specs

| Property | Value |
|---|---|
| Background | white |
| Border | 1px solid `--gray-200` |
| Border radius | `--radius-lg` (12px) |
| Padding | 20px 24px |
| Hover shadow | `0 3px 8px rgba(9,30,66,0.12)` |

### Card header

- Flex row, space-between, center-aligned
- 16px bottom padding + 1px `--gray-200` border separator
- Title: Satoshi 600 · 16px · `--gray-900` · −0.01em tracking

### Stat card

| Element | Style |
|---|---|
| Label | DM Sans 500 · 12px · uppercase · 0.07em tracking · `--gray-400` |
| Value | Satoshi 700 · 32px · `--gray-900` · −0.02em · line-height 1 |
| Sub text | DM Sans 400 · 13px · `--gray-500` |
| Delta pill (up) | `--success-light` bg · `--success-dark` text |
| Delta pill (down) | `--danger-light` bg · `--danger-dark` text |
| Delta pill (neutral) | `--gray-100` bg · `--gray-500` text |

### Progress bar

| Property | Value |
|---|---|
| Track height | 6px |
| Track background | `--gray-100` |
| Track radius | `--radius-full` |
| Fill transition | `width 0.4s ease` |

### Meal row

- 36×36px icon container · `--radius-md` · emoji centered
- Name: DM Sans 500 · 14px · `--gray-800` (truncated with ellipsis)
- Meta: DM Sans 400 · 12px · `--gray-400`
- Calorie value: Satoshi 600 · 15px · `--primary`
- Rows separated by 1px `--gray-100` bottom border; last row has no border

---

## Badges & tags

Small, high-information labels. Badges use uppercase + letter-spacing for legibility at small sizes.

### Status badges

Specs: DM Sans 600 · 11px · uppercase · 0.04em tracking · `--radius-sm` · 3px 9px padding

| Variant | Background | Text |
|---|---|---|
| Primary | `--primary-light` | `#0747A6` |
| Success | `--success-light` | `--success-dark` |
| Warning | `--warning-light` | `--warning-dark` |
| Danger | `--danger-light` | `--danger-dark` |
| Neutral | `--gray-100` | `--gray-600` |
| Breakfast | `#FFF7ED` | `#92400E` |

### Wing badge

- Background: `--gray-900` · text: white
- DM Sans 500 · 11px · uppercase · 0.06em tracking · `--radius-full` · 3px 10px padding

### Goal mode pills

Specs: DM Sans 500 · 12px · `--radius-full` · 4px 12px padding · 1.5px border

| Goal | Text / border | Background |
|---|---|---|
| Bulk | `#0747A6` | `--primary-light` |
| Cut | `--danger-dark` / `--danger` | `--danger-light` |
| Maintain | `--success-dark` / `--success` | `--success-light` |
| IPPT | `--warning-dark` / `--warning` | `--warning-light` |

---

## Navigation

Top nav for desktop, bottom tab bar for mobile. Both share the same active state colour.

### Top navigation (desktop)

Height: 60px · white background · `--gray-200` bottom border · horizontal padding: 24px

| Element | Style |
|---|---|
| Logo | Satoshi 800 · 20px · `--gray-900` · −0.03em; accent dot in `--primary` |
| Nav link (default) | DM Sans 500 · 14px · `--gray-500` · `--radius-md` padding |
| Nav link (hover) | `--gray-50` bg · `--gray-800` text |
| Nav link (active) | `--primary-light` bg · `--primary` text |
| Avatar | 36×36px · `--radius-full` · `--primary-light` bg · initials DM Sans 600 · 13px |

Links: Dashboard, Log meal, Progress, Rankings, Tips

### Bottom tab bar (mobile)

White bg · `--gray-200` top border · `--radius-xl` top corners · upward `--shadow-lg`

Tabs: Home, Log, Progress, Rankings, Profile

| Element | Style |
|---|---|
| Icon | 20×20px SVG |
| Label | DM Sans 500 · 10px · `--gray-400` |
| Active item | `--primary-light` background |
| Active label | `--primary` text |
| Active icon | `--primary` fill / stroke |

---

## Tables

Used for leaderboards and food logs. Always include a hover state. Header row uses uppercase labels.

### Table specs

| Element | Style |
|---|---|
| Header cell | DM Sans 600 · 11px · uppercase · 0.06em tracking · `--gray-400` · `--gray-50` bg · 2px `--gray-100` bottom border |
| Header padding | 12px 16px |
| Body cell | DM Sans 400 · 14px · `--gray-700` · 1px `--gray-100` bottom border |
| Body padding | 12px 16px |
| Row hover | `--gray-50` background |
| Last row | No bottom border |

### Rank number colours

| Rank | Colour |
|---|---|
| #1 | `#B45309` (gold) |
| #2 | `--gray-500` (silver) |
| #3 | `#92400E` (bronze) |
| 4+ | `--gray-900` |

Rank number font: Satoshi 700

---

## Alerts & toasts

Inline alerts for contextual feedback. Toasts for transient confirmations (auto-dismiss after 4s).

### Inline alerts

Specs: flex row · 12px gap · 16px padding · `--radius-lg` · 4px left border · DM Sans 400 · 14px

| Variant | Background | Border / text |
|---|---|---|
| Info | `#E6F0FF` | `--primary` / `#0747A6` |
| Success | `--success-light` | `--success` / `--success-dark` |
| Warning | `--warning-light` | `--warning` / `--warning-dark` |
| Danger | `--danger-light` | `--danger` / `--danger-dark` |

- **Alert title**: DM Sans 500 · same colour · 2px bottom margin
- **Alert icon**: 16×16px SVG · aligned to top of text block

### Toast notifications

Specs: inline-flex · center-aligned · 12px gap · `--gray-900` bg · white text · 12px 20px padding · `--radius-lg` · `--shadow-lg`

| Element | Style |
|---|---|
| Body text | DM Sans 400 · 14px · white |
| Action link | DM Sans 600 · 13px · `--primary-mid` · cursor pointer |
| Leading icon | 16×16px filled-circle SVG |

Dismiss after 4s. Always include an "Undo" or "Dismiss" action.
