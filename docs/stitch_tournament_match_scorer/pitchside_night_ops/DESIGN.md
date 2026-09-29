---
name: Pitchside Night Ops
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d6c3af'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9e8e7c'
  outline-variant: '#514535'
  surface-tint: '#ffb956'
  primary: '#ffca85'
  on-primary: '#452b00'
  primary-container: '#f2a93b'
  on-primary-container: '#664000'
  inverse-primary: '#835400'
  secondary: '#a5d0b9'
  on-secondary: '#0e3727'
  secondary-container: '#29513f'
  on-secondary-container: '#97c2ab'
  tertiary: '#d5d3ce'
  on-tertiary: '#30312d'
  tertiary-container: '#b9b8b3'
  on-tertiary-container: '#494945'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb5'
  primary-fixed-dim: '#ffb956'
  on-primary-fixed: '#2a1800'
  on-primary-fixed-variant: '#633f00'
  secondary-fixed: '#c1ecd4'
  secondary-fixed-dim: '#a5d0b9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#274e3d'
  tertiary-fixed: '#e4e2dd'
  tertiary-fixed-dim: '#c8c6c1'
  on-tertiary-fixed: '#1b1c18'
  on-tertiary-fixed-variant: '#474743'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  headline-xl:
    fontFamily: Anton
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 60px
    letterSpacing: 0.04em
  headline-xl-mobile:
    fontFamily: Anton
    fontSize: 44px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: 0.03em
  headline-lg:
    fontFamily: Anton
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: 0.03em
  headline-lg-mobile:
    fontFamily: Anton
    fontSize: 30px
    fontWeight: '400'
    lineHeight: 34px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Anton
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.02em
  scoreboard-num:
    fontFamily: Anton
    fontSize: 72px
    fontWeight: '400'
    lineHeight: 72px
    letterSpacing: 0.02em
  scoreboard-num-mobile:
    fontFamily: Anton
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: 0.02em
  eyebrow-accent:
    fontFamily: Anton
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.14em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-action:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-meta:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-tablet: 1rem
  margin: 1rem
  margin-tablet: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for tournament coordinators, grassroots referees, and touchline scorers operating under high-pressure outdoor conditions. It captures the visceral energy of a floodlit stadium pitch at night—crisp artificial illumination cutting through nocturnal gloom, marked white chalk lines, and high-impact digital scoreboards. 

The design aesthetic fuses **High-Contrast Utilitarianism** with **Atmospheric Sports Skeuomorphism**. Rather than relying on fragile, low-contrast modern minimalism, the interface utilizes bold physical visual metaphors: wide alternating pitch-cut stripes, high-lumen floodlight amber accents, and physical cream-colored match cards. Every element is calibrated for maximum legibility in harsh real-world environments—from glare-heavy midday direct sunlight to chilly, late-night rain under sodium floodlights. 

The emotional signature is focused, decisive, and electric. Touch targets are intentionally exaggerated to ensure zero mis-taps when wearing gloves or operating with damp fingers on the touchline.

## Colors

The color architecture is built strictly for dark mode, drawing inspiration from natural turf illuminated under high-intensity beam towers:

- **Surface & Canvas (Striped Pitch Ground):** The base viewport mimics an alternating mown pitch surface with horizontal bands:
  - Base Turf Dark: `#17402E`
  - Base Turf Medium: `#1B4332`
  - Deep Dugout Floor: `#0F291E`
- **Floodlight Amber (`#F2A93B`):** The primary interactive and high-visibility beacon color. Used for active match clocks, primary score adjustments, in-play indicators, and critical CTAs. Text placed on Amber surfaces must strictly use Ink Black (`#1B1B1B`) for extreme contrast.
- **Match Cards & Neutral Containers:**
  - Cream Card Surface: `#F7F5EF` (physical team sheet/referee card metaphor).
  - Chip & Segmented Surface: `#EDEAE0`.
  - Primary Card Typography: `#1B1B1B` (Ink Black).
  - Secondary/Muted Card Typography: `#6B675B` (Raw Umber).
  - On-Dark Typography: Primary text uses `#F7F5EF` at 100% opacity; secondary metadata uses `#F7F5EF` at 70% opacity.
- **Match Status & Disciplinary Indicators:**
  - Success Green: `#3B6D11` (Active clock, full-time confirmation, goal scored).
  - Danger Red: `#C63B3A` (Strictly reserved for red cards, dismissals, match abandonment, and final warnings).
  - Caution/Warning Brown: `#8A4B1B` (Yellow card/disciplinary tracking, pitch delay, technical warnings).

## Typography

The typographic hierarchy communicates authority, split-second readability, and operational precision:

- **Anton (Headings & Match Scores):** High-impact condensed display type rendered in uppercase. Mimics classic electronic stadium scoreboards and mechanical stadium clocks. Used for live score digits, team acronyms, match periods, and primary modal titles. 
- **Anton Accent Eyebrows:** Eyebrow labels, pitch identifiers, and sub-labels are rendered in Anton at small sizes (`14px`) with aggressive letter-spacing (`0.14em`) and tinted in Floodlight Amber (`#F2A93B`) to establish immediate hierarchical context without visual clutter.
- **Inter (Operational & Structural Engine):** Inter handles everything requiring sustained reading, data dense tables, roster lineups, referee logs, and touch controls. High-contrast font weights (`600` SemiBold and `700` Bold) are prioritized to withstand sun glare and viewing at arm's length.

## Layout & Spacing

The layout is optimized for single-handed mobile touchline operation.

- **Grid & Margins:** A compact 4-column layout on mobile devices transitioning to an 8-column layout on tablet terminals. Outer margins are anchored at `1rem` (16px) to maximize horizontal real estate for live data while providing a protective edge against accidental palm triggers.
- **Horizontal Pitch Striping:** The primary body viewport features rhythmic 80px-tall horizontal alternating striping between `#1B4332` and `#17402E`. Cards, fixtures, and score tickers snap cleanly to this visual rhythm.
- **Ergonomic Thumb Zone Architecture:** 
  - **Upper 40% (Observation Deck):** Match timer, aggregate scoreboard, pitch location, and disciplinary ticker. Non-interactive or passive inspection zone.
  - **Lower 60% (Action Command Zone):** Primary match controls, scoring buttons, sub cards, and whistle triggers. All interactive targets in this region respect the 64dp+ ergonomic minimum.

## Elevation & Depth

Visual hierarchy uses **High-Lumen Tonal Layering** and **Tactile Stadium Decking**, deliberately avoiding subtle ambient blurs that degrade under harsh daylight.

- **Level 0 (Pitch Turf):** Striped grass canvas (`#1B4332` / `#17402E`). Deep, non-reflective base plane.
- **Level 1 (Cream Match Cards):** Ground-level containers (`#F7F5EF`) sitting firmly atop the turf. Outlined by an ultra-crisp `1px` solid border (`rgba(255, 255, 255, 0.15)` on dark turf, or `#EDEAE0` on internal dividers). No diffused shadows; instead, a solid `0 2px 0 0 #0F291E` drop lip provides physical paper-card depth.
- **Level 2 (Active Scoreboard Deck):** Pitchside floating panels and match summary pods use saturated deep slate green (`#0F291E`) with a high-intensity floodlight glow: `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(242, 169, 59, 0.3)`.
- **Level 3 (Modal Sheets & Disciplinary Drawer):** Overlaid sheets feature stark black backdrop scrims (`rgba(11, 26, 19, 0.85)`) topped with a top-lip floodlight border: `2px solid #F2A93B`.

## Shapes

The design system enforces a disciplined `12px–14px` border radius (`rounded-lg`), balancing industrial resilience with modern mobile ergonomics. 

- **Match Sheets & Information Cards:** Fixed at `12px` to evoke physical referee pocket cards, tournament accreditation passes, and team lineups.
- **Scoring Buttons & Primary Action Tiles:** Set at `14px` corner radii with inset padding to produce punchy, tactile pads that feel confident and unmissable underfoot on the sideline.
- **Chips & Quick Pills:** Fully curved or `12px` rounded rectangles for status pills, pitch numbers, and division tags.

## Components

### Buttons & Touch Targets
- **Primary Scorer Buttons (+1 / -1 Goal, Points):** Minimum `64px` height and width. Placed within the lower thumb zone. Background in Floodlight Amber (`#F2A93B`) with Ink Black (`#1B1B1B`) Anton typography. Pressed states compress vertically by `2px` with a darkened top shadow (`#D48F28`).
- **Tactical Action Buttons (Sub, Yellow Card):** Secondary actions feature Cream Card surfaces (`#F7F5EF`) with deep charcoal borders and bold Inter lettering. Height: minimum `48px`.
- **Match End / Final Whistle CTA:** Sticky full-width footer button (`56px` height) with a Caution/Action striping effect or solid Success Green (`#3B6D11`) and high-contrast white Anton typography.

### Match Cards & Pitch Sheets
- **Match Fixture Card:** Cream canvas (`#F7F5EF`) featuring high-contrast black typography (`#1B1B1B`). Left-side status bar colored conditionally (Success Green for live, Floodlight Amber for half-time, Muted Gray for scheduled).
- **Scoreboard Module:** Dark stadium deck module (`#0F291E`) floating above the striped pitch, featuring double-digit scoreboard numbers rendered in Anton (`56px+`) split by an amber-pulsing colon.

### Disciplinary Cards & Chips
- **Status Chips:** Base color `#EDEAE0` for neutral statuses, `#3B6D11` with white text for active match states.
- **Foul/Card Badges:** Strict physical card proportions. Yellow card: `#F2A93B`. Red card: `#C63B3A`. Inscribed with bold Anton jersey numbers for instant official verification.

### Form Inputs & Number Spinners
- Field backgrounds use `#EDEAE0` inside match cards, or `#0F291E` on pitch canvas with a `1.5px` border in `#F2A93B` upon focus. Minimum touch target for time-spinners and roster toggles: `48px`.