# Prompts for Google Stitch — Tournament Scheduler screens

**How to use this file**

- Stitch designs **screens** and doesn't wire them to the API. That wiring is Claude Code's job.
- Stitch works best when you start a project with the **design brief** (Prompt 0) and then ask for
  **one screen per prompt**. It drifts when a single prompt describes a whole app.
- Pick **Mobile** as the device. After each screen, refine with short follow-ups ("make the goal
  buttons bigger", "use the amber accent for the active tab").
- Generate the football version of each screen first. Then ask Stitch to "make a Cricket variant of
  this screen using the cricket palette".
- When you're happy, export the designs (HTML or Figma) and give them to Claude Code as a visual
  reference. The real colours and fonts live in `src/theme/theme.ts` and must win over anything
  Stitch changed.

---

## Prompt 0 — Design brief (paste first, in a new project)

```
Design a mobile app called "Tournament Scheduler" — the organiser's and scorer's app for amateur
FOOTBALL and CRICKET tournaments. The user stands on the touchline, outdoors in bright sun, often
one-handed, scoring a match live on an Android phone. Everything must be big, high-contrast, and
fast to tap.

Visual concept: "floodlit ground at night". A dark page painted as a striped playing surface
(wide horizontal stripes alternating two close shades), bold condensed scoreboard lettering, and
warm floodlight accents. Content sits on cream cards with rounded corners (12–14px) or on subtle
translucent dark panels.

Two sport skins — the whole app re-tints to the tournament's sport:
- FOOTBALL: stripes #1B4332 / #17402E (pitch green), accent amber #F2A93B, dark text on accent #1B1B1B.
- CRICKET: stripes #12243B / #0F1F34 (dusk navy), accent gold #E8B03A, dark text on accent #12243B.
Shared: cream card #F7F5EF, ink text #1B1B1B, muted text #6b675b, chip background #EDEAE0,
text on dark #F7F5EF (secondary at 70% opacity), success green #3b6d11, danger red #c63b3a
(red is used ONLY for red cards and wickets), warning brown #8a4b1b.

Typography:
- Anton (all caps) for titles, team names on scoreboards and big score numbers.
- Teko SemiBold, widely letter-spaced, all caps, in the accent colour for small "eyebrow" labels
  above titles (e.g. "MATCHDAY SCHEDULER", "2ND HALF", "OVER 14").
- Inter for body text, lists and buttons.

Rules: portrait phone only, dark mode only. Minimum touch target 48dp; main scoring buttons 64dp
or larger and placed in the bottom half of the screen (thumb zone). Primary buttons are filled
with the accent colour; secondary buttons are outlined in cream. Status chips are small rounded
pills. No stock photos, no illustrations of players, no gradients other than the pitch stripes.
Feels like a stadium scoreboard crossed with a clean modern sports app.
```

---

## Prompt 1 — Home

```
Home screen. Top: eyebrow "MATCHDAY SCHEDULER" in amber, title "YOUR TOURNAMENTS" in Anton, and a
small "Server" icon button top-right (shows connection). Below: a two-option segmented control
"⚽ Football | 🏏 Cricket" — switching it re-tints the whole screen to that sport. Then a cream
card "New tournament" with a text field (placeholder "e.g. Summer Cup 2026") and an amber
"Create" button. Then a list of tournament cards: name in bold, created date in muted text, and a
status chip — "Setting up" (amber tint), "Schedule ready" (green tint) or "Started" (blue tint).
Show 4 example tournaments. Include pull-to-refresh affordance.
```

## Prompt 2 — Tournament hub before start (setup checklist)

```
Tournament hub for "Summer Cup 2026" (football), before the tournament has started. Header with
back arrow and the tournament name in Anton. A vertical 3-step checklist of cream cards, each with
a step number, title, status line and button:
1 "Teams" — "8 teams · 96 players" — button "Manage" (done, green check).
2 "Groups & schedule" — "2 groups · 24 matches · 6 rounds" — buttons "Rebuild" and "History".
3 "Start tournament" — "Creates all matches and locks the schedule" — large amber button
"START TOURNAMENT".
Below: a read-only preview of fixtures, grouped "GROUP A" then "ROUND 1", each fixture a compact
row "Rovers vs United".
```

## Prompt 3 — Tournament hub after start (Matches tab)

```
Same tournament after it has started. Under the header, a 4-tab segmented control:
"Matches · Table · Stats · Teams" (Matches active). Filter chips: All · Live · Upcoming · Completed.
A pinned LIVE match card at top: a pulsing amber live dot, "LIVE · 2nd half 67'",
"ROVERS 2 – 1 UNITED" in Anton. Then sections "GROUP A", "GROUP B" with match cards:
upcoming ("Match 5 · Athletic VS City"), completed ("FT  3 – 3  · pens 4–3"), half-time ("HT").
Each card shows match number, both team names, score or VS, and a status line.
```

## Prompt 4 — Team squad and player form

```
Team squad screen for "Rovers FC": header with team name and player count, an "Add player"
amber button. List of players sorted by jersey number: a jersey-number badge in a circle, name,
position chip (GK/DEF/MID/FWD). Swipe or overflow for edit/delete.
Also show the "Add player" bottom sheet: fields Name, Jersey number (numeric), Position with quick
chips GK · DEF · MID · FWD, and a Save button.
Then a CRICKET variant of the sheet: Name, Jersey number, Role (Batter / Bowler / All-rounder /
Wicket-keeper / WK-batter as chips), Batting (Right-hand / Left-hand), Bowling arm (Right / Left)
and Bowling type (Fast, Fast-medium, Medium-fast, Medium, Finger spin, Wrist spin) shown only for
bowlers, with a live label like "Right-arm leg break", and preferred batting position.
```

## Prompt 5 — Groups & schedule wizard

```
A 4-step wizard with a progress indicator at top (Teams · Groups · Format · Preview).
Show the "Groups" step: a stepper "Number of groups: 2", two buttons "Randomise" and "Assign
manually", then two group columns "GROUP A" and "GROUP B" as cream cards listing team chips. In
manual mode, tapping a team chip then a group moves it.
Then show the "Preview" step: per group a summary line "4 teams · 3 rounds · 3 matches each",
an amber warning callout ("Group B: capped at 3 matches per team without repeat fixtures"), and
fixtures listed under "ROUND 1", "ROUND 2"… Bottom bar: "Regenerate" (outline) and "Approve
schedule" (amber, filled).
```

## Prompt 6 — Football match setup

```
Football match setup for "Rovers vs United". Section "RULES" as a cream card: steppers for
Players per side (11), Minimum players (7), Minutes per half (45), Max substitutions (5); switches
for Rolling subs, Draw allowed, Extra time allowed (with "Extra time half length: 15" stepper
appearing when on). Section "SQUADS" with a two-tab toggle Rovers | United; each player row has a
3-state segmented chip Starting / Bench / Out, and a sticky counter "Starting 9 / 11". Bottom
sticky amber button "KICK OFF" (disabled state shown until both teams have 11 starters).
```

## Prompt 7 — Football live scoring console (most important)

```
Live football scoring console, designed for one-handed use in sunlight.
TOP scoreboard on the dark pitch: eyebrow "2ND HALF", team names "ROVERS" and "UNITED" in Anton,
a huge score "2 – 1", and a large running clock "67:12" (when in stoppage show "90+2"). A small
"Subs 2/5" per team.
MIDDLE: event timeline, newest first — "63' ⚽ J. Smith (assist A. Khan)", "58' 🟨 M. Lee",
"46' ⇄ Off: P. Diaz  On: R. Cole", "HT".
A thin row of secondary controls: Pause, +Stoppage, "End 2nd half", overflow menu (Force
complete / Abandon).
BOTTOM action bar in the thumb zone: two very large buttons "GOAL ROVERS" and "GOAL UNITED"
(accent filled), and under them three medium buttons "Yellow" (yellow), "Red" (red), "Sub".
Also show the "Goal" bottom sheet: pick scorer from a grid of player tiles (jersey number + name,
plus "Unknown / Own goal"), then optional assist, then "Save goal".
```

## Prompt 8 — Penalty shootout

```
Penalty shootout screen. Scoreboard "ROVERS 4 – 3 UNITED (pens)". For each team, a row of 5
circles: filled = scored, ✕ = missed, empty = still to take; a "SUDDEN DEATH" label appears after
round 5. A highlighted banner "Rovers to kick". A horizontal list of eligible takers to pick one.
Two huge buttons at the bottom: "SCORED" (green) and "MISSED" (outline). Also show the winner
state: "ROVERS WIN 5–4 ON PENALTIES" celebration card with "Back to match".
```

## Prompt 9 — Cricket match setup (use cricket palette)

```
Cricket match setup, navy/gold cricket skin. Step 1 "FORMAT": horizontally scrolling preset
cards — T20, T10, ODI, The Hundred, Test, Two-innings, Box/Gully — each showing overs and players
("20 overs · 11 a side"); T20 selected, with a note "Same format as Match 3". An "Edit rules"
disclosure revealing grouped settings (Overs & players, Extras, Result rules, Conditions).
Step 2 "TOSS": "Who won the toss?" team toggle, "Elected to" Bat | Bowl.
Step 3 "PLAYING XI": team tabs; button "Same as last match vs Strikers"; rows with Playing /
Bench / Out, "C" captain and "WK" keeper toggles, a batting-order number, and the player's role
and bowling style in muted text. Counter "Playing 11 / 11". Sticky gold button "START MATCH".
```

## Prompt 10 — Cricket scoring console (use cricket palette)

```
Live cricket scoring console, navy/gold skin, for fast one-handed ball-by-ball scoring.
HEADER: "STRIKERS" eyebrow, huge "148/6" in Anton, "(17.3 / 20 ov)", "CRR 8.46". When chasing:
"Need 24 off 15 · RRR 9.60". A "FREE HIT" gold badge variant.
CREASE CARD: striker "● A. Sharma 54 (38) 4×4 2×6", non-striker "R. Patel 12 (9)",
bowler "J. Brown 3.3-0-28-2", partnership "41 (27)".
THIS OVER strip of ball chips: "1", "4" (gold), "W" (red), "wd", "0", "2".
RUN PAD at the bottom: a grid of big buttons 0 1 2 3 4 6 and "5+", toggles "Wide", "No ball",
"Byes", "Leg byes", a large red "WICKET" button, and an always-visible "Undo" button.
Top-right overflow: Scorecard, Reduce overs (rain), Declare, End innings, Complete match.
Also show the WICKET bottom sheet: dismissal types (Bowled, Caught, LBW, Run out, Stumped, Hit
wicket…), then "Who's out?" (striker / non-striker), then "Fielder" picker, then "Confirm wicket".
And the "Choose next bowler" sheet listing bowlers with overs bowled.
```

## Prompt 11 — Cricket scorecard

```
Full cricket scorecard. Top: result banner "Strikers won by 12 runs" and toss line. Innings
switcher tabs. Batting table: Batter, how out (muted small text), R, B, 4s, 6s, SR — the batter's
name column frozen when scrolling sideways. Extras line "Extras 9 (wd 4, nb 2, lb 3)", Total
"168/7 (20 ov) · RR 8.40". Fall of wickets as a wrapped chip list "1-23 (Sharma, 3.2)". Bowling
table: Bowler, O, M, R, W, Econ, wd, nb.
```

## Prompt 12 — Table and Stats tabs

```
Two screens.
(1) "Table" tab: standings per group. Football columns P W D L GF GA GD Pts; the top 2 rows
highlighted as qualifying. Cricket variant: P W L T NR Pts NRR plus a form strip of small pills
W (green) L (muted grey — red is reserved for wickets) T D NR.
(2) "Stats" tab: a grid of summary tiles (Matches 18/24, Goals 57, Goals per match 3.2, Clean
sheets 9, Cards 22Y/3R), then horizontally scrolling leaderboard chips "Top goalscorers · Top
assists · Goal contributions · Most appearances · Most minutes · Most yellow cards · Most red
cards", and a ranked list: rank, player, team, big value on the right, and a per-match figure,
with a small rule note under the board title. Cricket variant tiles: Runs, Wickets, 4s, 6s, 50s,
Highest score, Best bowling, MVP; board chips: Most runs, Highest score, Best batting average,
Best strike rate, Most wickets, Best bowling figures, Best economy, Most catches, Most valuable
player (fantasy points).
```
