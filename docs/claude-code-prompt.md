# Prompt for Claude Code — build the Tournament Scheduler mobile app

> Paste everything below the line into Claude Code, started inside `tournament-scheduler-mobile/`.
> If you designed screens in Stitch first, add at the end: "Visual reference: the Stitch export in
> `<folder>` — match its layout, but keep every colour, font and spacing value from `src/theme/theme.ts`."

---

## 1. What you are building

**Tournament Scheduler** is an app that runs amateur **football and cricket tournaments** from end
to end. It covers creating the tournament, adding teams and players, drawing groups, generating a
fixture schedule, **scoring each match live from the touchline**, and producing standings and
leaderboards.

The mobile app is the **scorer's and organiser's tool**. Picture the person using it: standing at
the side of a pitch, outdoors in bright sunlight, often using one hand, on a mid-range Android phone,
on the same Wi-Fi as a laptop that hosts the API. Every scoring action must be fast, hard to hit by
mistake, and readable at arm's length.

A React web app (`../tournament-scheduler-ui`) already does everything described here. The mobile
app must feel like **the same product**: same names, same wording, same rules and same colours.
When you are unsure how something should behave, read the matching web component (listed in §9)
and do the same thing in a mobile-native way.

## 2. What already exists (phase 0, done): read it first

Read `CLAUDE.md`, `AGENTS.md`, `README.md` and everything in `src/` before writing anything.

- **Stack:** Expo SDK 57, Expo Router (file-based routes in `src/app/`), TypeScript, React 19 with
  React Compiler, Reanimated 4, Gesture Handler, AsyncStorage, typed routes on.
- **Runs in Expo Go** on an Android phone. **Do not add any library that needs a custom native
  build.** Install packages only with `npx expo install`. `expo-haptics` is fine and is encouraged
  for scoring feedback. Prefer Expo modules to third-party UI kits. Do not add a component library
  such as Paper, NativeBase or Tamagui.
- `src/api/client.ts` is **the only way to call the API**: `api.call<T>("SERVICE_ID", { routeParams, query, body })`.
  Screens never use `fetch` or URLs. Add every new endpoint to `src/api/routes.ts` as an
  `AREA_ACTION` service ID with `{name}` path placeholders. The IDs will later go into an encrypted
  gateway, so keep them stable and descriptive.
- `src/api/errors.ts` turns failures into readable messages. `ApiError` carries `.status` and
  `NetworkError` means the server can't be reached. Show those messages **verbatim** in
  `ErrorBanner`, because the API writes human-readable rule explanations.
- `src/config/server.tsx` stores the server address. The Server sheet (`src/app/server.tsx`) edits
  and tests it.
- `src/theme/theme.ts` holds **all** colours, fonts, spacing, radii and the type scale. Always use
  `type.*`, `space.*`, `radius.*` and `themeFor(sport)`. Never write a hex value or `fontWeight`
  in a screen.
- Components: `PitchBackground` (striped pitch/ground backdrop), `PressableScale` (press feedback),
  `ErrorBanner`.
- Screens: `index.tsx` (home: sport toggle, tournament list, create) is done. `server.tsx` is done.
  `tournament/[id].tsx` is a **placeholder** that you replace.

## 3. Visual design and theme

The look is **"floodlit ground at night"**: a dark striped playing surface, bold condensed
scoreboard type, and warm light accents. The app has two sport skins, and the whole screen re-tints
to the tournament's sport.

| Token | Football | Cricket |
|---|---|---|
| Page / stripes | `#17402E` / `#1B4332` (pitch green) | `#0F1F34` / `#12243B` (dusk navy) |
| Accent | `#F2A93B` amber | `#E8B03A` gold |
| Text on accent | `#1B1B1B` | `#12243B` |
| Tint (selected on cream) | `#E3EEE6` | `#E1E8F2` |

Colours shared by both skins:

- Cream cards `#F7F5EF` with ink text `#1B1B1B`, muted text `#6b675b` and chips `#EDEAE0`.
- Text on the dark background is `#F7F5EF`, or 70% cream for secondary text.
- Surfaces on dark are cream at 8% opacity, with borders at 18%.
- Success is `#3b6d11`, danger is `#c63b3a` and warning text is `#8a4b1b`.
- **Red means only a red card or a wicket.** Never use it for decoration.

Typography:

| Font | Role | Used for |
|---|---|---|
| **Anton** | Display, uppercase | Titles, scores, team names on the scoreboard |
| **Teko** | Condensed, letter-spaced | Eyebrows and labels ("MATCHDAY SCHEDULER", "2ND HALF", "OVER 14") |
| **Inter** | Body | Everything else |

The type scale is already defined in `type`.

Layout rules:

- Dark page with `PitchBackground` behind it. Content sits on cream cards (radius 12–14) or
  translucent dark surfaces. The standard gutter is 16. Respect safe areas.
- **Touch targets are at least 48dp. Primary scoring buttons are at least 64dp.** Keep main
  actions in the thumb zone (bottom half). Use a sticky bottom action bar on the live screens.
- Scores and the clock use large Anton numerals with tabular figures, and must be readable at arm's
  length in sunlight. Keep contrast at 4.5:1 or better everywhere (the theme's values already pass).
- Motion should be quick and purposeful:
  - a score "bump" when a goal or run is recorded
  - a press scale on every button
  - sheets for pickers
  - Reanimated for anything animated
  - honour Reduce Motion
- Haptics: a light tap on each recorded ball or event, a success haptic on a goal or wicket, and
  a warning haptic on errors.
- Portrait only. The app is dark-only (`userInterfaceStyle: "dark"`).
- Status chips follow the web's pattern:
  - Setting up: amber
  - Schedule ready: green
  - Started / Live: blue or accent, with a pulsing dot for live matches
  - Completed: muted

## 4. How the app must behave (non-negotiable)

1. **The server decides the rules; the app only draws them.**
   - The football match object carries computed flags: `canEndPeriod`, `canStartNextPeriod`,
     `awaitingResolution`, `canStartPenalties`, `penaltiesRequired`, `canCompleteNormally`,
     `stoppageRemainingThisPeriod`, `maxStoppageThisPeriod`, `currentPeriodLabel`,
     `nextPeriodLabel`, `maxPeriods`, `isFinalPeriod` and `extraTimeApplicable`.
   - The cricket state carries an `actions` object: `canRecordBall`, `needsBatter`, `needsBowler`,
     `canUndo`, `canDeclare`, `canEndInnings`, `canEnforceFollowOn`, `canStartSuperOver`,
     `canComplete`, `canReduceOvers`, `canStartInnings`, `nextBattingTeamId`,
     `availableBatters`, `availableBowlers` and `possibleDismissals`.
   - Show, hide or enable buttons **only** from these flags. Never re-implement football or cricket
     law on the client.
2. **Cricket endpoints return the full match state on every call**, so redraw from the response
   with no second fetch. Football action endpoints return small payloads, so after each football
   action re-fetch `GET matches/{id}` (and the events list).
3. **Errors:** the API answers 400/409 with a plain-text sentence. Show it as-is in an
   `ErrorBanner` near the action that failed. Keep the user's input, and never navigate away on
   error. A `NetworkError` gets a "Change server" shortcut to the Server sheet.
4. **Guard every mutation:** disable the button and show a spinner while the request is in flight,
   so a double tap can never record two goals or two balls.
5. **Confirm anything destructive or irreversible** with a clear dialog that names the
   consequence. That includes:
   - deleting a tournament, team or player
   - starting a tournament (it locks the schedule)
   - ending a period
   - force-completing or abandoning a match
   - declaring or ending an innings
   - ending a shootout manually

   **Don't** confirm routine scoring: goals, cards and balls are recorded on tap, and cricket has
   Undo.
6. **Every list has four states:** loading (a skeleton, not a bare spinner), empty (explains the
   next step and offers the action), error (with a retry button) and content. Support
   pull-to-refresh.
7. **Enums come back as strings** (for example `"Football"`, `"InProgress"`, `"SubstitutionIn"`)
   and **JSON is camelCase**. Send enums as strings too. Write TypeScript types for every
   response in `src/api/types.ts`.
8. **Timestamps:** the server sends UTC, and some fields arrive **without a `Z`**. Treat an
   offset-less timestamp as UTC. The web's `parseUtc` in `LiveMatch.jsx` does exactly this.
9. **Live data:** while a live screen is focused, poll the match every 5 seconds so a second device
   stays in sync. Pause polling when the app is backgrounded or the screen loses focus.

## 5. The domain in brief

- A **Tournament** has a `name` and a fixed `sport` (`Football` | `Cricket`), plus `isStarted`,
  `hasSchedule` and `latestScheduleId`. The sport never changes and decides the theme and every
  match screen.
- **Teams** belong to one tournament, and team names are unique within it.
- **Players** belong to one team. A player has a `name`, an optional `jerseyNumber` (unique within
  the team) and a football `position` (free text).
- Cricket players carry a `cricket` profile:
  - `primaryRole`: Batter | Bowler | AllRounder | WicketKeeper | WicketKeeperBatter
  - `battingStyle`: RightHand | LeftHand
  - `bowlingArm` (Right | Left) and `bowlingType` (Fast | FastMedium | MediumFast | Medium |
    FingerSpin | WristSpin), asked only when the role bowls (Bowler or AllRounder)
  - `battingOrderPreference`
- A cricket team also has `defaultCaptainPlayerId`.
- **Groups** (A, B, C…) are drawn randomly or assigned by hand. Each group needs at least 2 teams.
- **Schedule:** the organiser chooses matches per team (1–60) and whether repeat fixtures are
  allowed. The server generates a round-robin grouped into **rounds (matchdays)**, where no team
  plays twice in a round. The result includes warnings and per-team match counts.
  - The organiser previews the result, can regenerate, then **approves** it (saved).
  - The last 5 saved schedules are kept, and exactly one of them is active.
- **Starting the tournament** creates one match per fixture of the active schedule and **locks the
  schedule for good**.
- **Football match:** set up rules and the squad, and it kicks off immediately. The flow is:
  - first half → end period → second half
  - then, if level and extra time applies, extra time halves 1 and 2
  - then, if still level and draws aren't allowed, a penalty shootout
  - then complete

  Along the way the scorer records goals (with optional scorer and assist), yellow cards (a second
  yellow sends the player off automatically), red cards, substitutions, pause and resume, and
  added stoppage time. **Only one football match per tournament can be in progress at a time**
  (the API returns 409 otherwise).
- **Cricket match:** the flow is:
  - setup: a rules preset or custom rules, the toss, and both XIs with captain, keeper and batting
    order
  - start the innings with a striker, non-striker and bowler
  - record ball by ball
  - pick a new batter after a wicket and a new bowler after each over
  - the innings ends on its own (overs, all out, target chased), or by declaration or abandonment
  - the next innings, and possibly a follow-on, super over, or DLS target after rain
  - result

  Formats cover limited overs (T20, T10, ODI, The Hundred, Box/Gully) and multi-innings (Test,
  two-innings limited overs).
- **Stats** are built from completed matches only.
  - Football: summary, group standings and player leaderboards.
  - Cricket: points table with NRR and form, batting, bowling and fielding boards, the MVP, player
    of the match and team records.

## 6. Screens and navigation

The route map uses Expo Router. Adjust the file names if you have a cleaner structure, but keep one
route per screen.

```
src/app/
  _layout.tsx                         root Stack (exists)
  index.tsx                           Home (exists — extend)
  server.tsx                          Server sheet (exists)
  tournament/[id]/_layout.tsx         Stack for a tournament, themed by its sport
  tournament/[id]/index.tsx           Tournament hub (setup checklist before start, tabs after)
  tournament/[id]/teams/index.tsx     Teams list
  tournament/[id]/teams/[teamId].tsx  Team squad + players
  tournament/[id]/schedule.tsx        Groups + schedule builder (wizard)
  tournament/[id]/schedules.tsx       Saved schedule history (sheet)
  football/[matchId]/setup.tsx        Football match setup
  football/[matchId]/live.tsx         Football live console (also the read-only summary once completed)
  football/[matchId]/penalties.tsx    Penalty shootout
  cricket/[matchId]/setup.tsx         Cricket match setup
  cricket/[matchId]/live.tsx          Cricket scoring console
  cricket/[matchId]/scorecard.tsx     Full scorecard
```

The tournament hub shows **Matches · Table · Stats · Teams** as a segmented control or top tabs.

### 6.1 Home (extend what exists)

- Keep the sport toggle, the list and the inline create.
- Add delete via long-press or swipe, with a confirm.
- Add a better empty state per sport.
- Each tournament card shows the name, a status chip and the created date.

### 6.2 Tournament hub: before start

A **setup checklist** with three steps. Each step shows its state and a button.

1. **Teams:** "8 teams · 96 players", then Manage. At least 2 teams are needed.
2. **Groups & schedule:** "Active schedule: 2 groups · 24 matches", then Build or Rebuild, plus
   View history.
3. **Start tournament:** enabled only once a schedule is active. The confirm reads "This creates
   24 matches and locks the schedule. You can't change it afterwards."

Also show the active schedule's fixtures, read-only, grouped by group and then by round.

### 6.3 Tournament hub: after start

- **Matches tab:**
  - Filter chips: All · Live · Upcoming · Completed.
  - A section per group, ordered by match number.
  - Pin any live match to the top.
  - Football card:
    - both team names, the score (or "VS" when not started) and a status line: "LIVE · 2nd
      half", "HT", "FT", "FT · pens 4–3", or "Forfeit"
    - tap to open setup if not started, otherwise the live screen or summary
  - Cricket card:
    - each team with its `homeLine`/`awayLine` ("148/6 (20.0)", "300 & 150/4"), or "VS"
    - the status, and `resultSummary` when finished
- **Table tab:** standings per group.
  - Football columns: P W D L GF GA GD Pts. On tap, a row expands to show clean sheets, cards and
    shootouts.
  - Cricket columns: P W L T NR Pts NRR, plus a form strip of W/L/T/D/NR pills.
  - Freeze the team-name column when the table scrolls horizontally.
- **Stats tab:**
  - A summary card grid at the top.
  - Then leaderboards as horizontally scrolling chips, one per board (`title`). Each shows the rank,
    player, team and value, plus its detail columns, and shows the board's `note` or
    `qualification`.
  - Cricket adds MVP, Player of the Match, Records (highest totals, lowest totals, biggest wins,
    partnerships) and a "How points work" sheet from `pointsSystem`.
  - Show `basis` and `notes` in small text.
- **Teams tab:** the same teams list as below.

### 6.4 Teams and players

- **Teams list:** add a team (name, 409 if the name is taken), rename, delete, and show the player
  count.
- **Team squad:**
  - Players sorted by jersey number, then name.
  - Add or edit a player in a bottom-sheet form.
  - **Football fields:** name, jersey number and position (free text, with quick chips GK, DEF,
    MID, FWD).
  - **Cricket fields:** name, jersey number, role, batting style, and bowling arm plus type (shown
    only when the role bowls). Show a live label such as "Right-arm leg break" or "Slow left-arm
    orthodox" (the naming table is in `CricketEnums.cs`), plus the preferred batting position.
  - A cricket team also has a "default captain" picker.

### 6.5 Groups and schedule builder (wizard, one step per screen section)

1. **Teams in play:** choose which of the tournament's teams take part. All are selected by
   default.
2. **Groups:** a group-count stepper, then either **Randomise** (`TOURNAMENT_GROUPS_RANDOMIZE`) or
   **Assign manually**: tap a team, then tap a group. Don't use drag and drop. The rule is at least
   2 teams per group.
3. **Format:** a matches-per-team stepper (1–60) and an "Allow repeat fixtures" switch with a
   one-line explanation. Without repeats, the cap is group size − 1.
4. **Preview:** fixtures per group, organised by **Round 1, Round 2…**. Show a per-group summary
   (teams, rounds, matches-per-team range) and any **warnings** in an amber callout. Offer
   Regenerate, and Approve (`TOURNAMENT_SCHEDULE_APPROVE`, which sends `tournamentId` +
   `schedule`).
- **History sheet:** the last 5 schedules with date, total matches and an Active badge. "Make
  active" is disabled once the tournament has started.

### 6.6 Football match setup

- Rules:
  - players per side, and a minimum players per side. The UI suggests 7 for 11-a-side; the server
    treats an omitted value as 1. When red cards take a side below the minimum, the match is
    abandoned.
  - minutes per half
  - max substitutions and a rolling-subs switch
  - a **Draw allowed** switch and an **Extra time allowed** switch. These are mutually exclusive:
    turning one on turns the other off. Extra time needs an extra-time half length that is ≤ the
    regulation half.
- Squad: one section per team. Each player gets a three-state chip: **Starting / Bench / Out**.
  Show the counter "Starting 9/11", and enable **Kick off** only when each team has exactly `max
  players per side` starters.
- Kick off calls `MATCH_SETUP`, which also starts the clock. It navigates to Live. If the API
  returns 409 (another match is live), show the message with a button to open that live match.

### 6.7 Football live console (the most important screen)

**Top: the scoreboard.**

- Home and away names in Anton, and a big score.
- Eyebrow: `currentPeriodLabel`.
- A running clock `MM:SS` that shows `45+2` once past the period length.
- A PAUSED or HALF-TIME banner.

The clock is computed on the phone each second from the match fields:

1. Start with `elapsed = now − halfStartedAt − pausedDurationMs`.
2. While paused, also subtract the time since `pausedAt`.
3. `minute = priorPeriodsMinutes + elapsed`.

The server is still the authority for event minutes. Copy the logic in `LiveMatch.jsx`.

**Middle:** a timeline of events, newest first, with the minute, an icon and the player names.
Goal shows the assist, a sub shows off→on, and cards are yellow or red.

**Bottom action bar (thumb zone).** Two large team-coloured **GOAL** buttons (home | away), then a
row of **Yellow · Red · Sub**:

- **Goal:** a sheet to pick the scorer (on-pitch players, or "Unknown / own goal"), then an
  optional assist. Save sends `EventType: "Goal"`, with `teamId`, `playerId` as the scorer and
  `relatedPlayerId` as the assist.
- **Yellow / Red:** pick the team, then the on-pitch player. If the response has
  `matchAbandoned: true`, show a full-screen "Match abandoned: team reduced below minimum" result.
- **Sub:** pick the team, then the player **off** (on pitch), then the player **on** (bench). Send
  `EventType: "SubstitutionIn"`, with `playerId` as the one going off and `relatedPlayerId` as the
  one coming on. Show "Subs used 2/5".

**Match control row (secondary, smaller, above the bar).** Only these buttons appear, each only
when its flag allows:

- Pause / Resume.
- **+ Stoppage**: a minute stepper up to `stoppageRemainingThisPeriod`.
- **End {currentPeriodLabel}** when `canEndPeriod`.
- **Kick off {nextPeriodLabel}** when `canStartNextPeriod`.
- **Go to penalties** when `canStartPenalties`: a sheet for takers per side (default 5), then the
  Penalties screen.
- **Full time** when `canCompleteNormally`.
- **Force complete / Abandon**, placed behind an overflow menu. It shows a confirm, with an
  optional "award to" team choice, and sends `force: true`.

**Completed:** the same screen goes read-only, with the final score, "FT" or "AET" or "pens 4–3",
and the full timeline.

### 6.8 Penalty shootout

- A scoreboard of penalties, with a row of dots per team: ● scored, ✕ missed, ○ to come. Show a
  "Sudden death" label once regular kicks run out.
- `nextTeamId` highlights whose turn it is.
- Pick a taker from `homeAvailableTakerIds` or `awayAvailableTakerIds`, then tap the big
  **SCORED** or **MISSED** button.
- When `outcome` is no longer `InProgress`, show a winner celebration and return to the match.
- The manual "End shootout, declare winner" option sits in the overflow menu, with a confirm.

### 6.9 Cricket match setup

Load `CRICKET_SETUP_OPTIONS`.

1. **Format:** preset cards (T20, T10, ODI, The Hundred, Test, Two-innings limited overs, Box /
   Gully). If a previous match was set up, pre-select `lastFormat` with the note "Same format as
   Match 3". Behind an "Edit rules" disclosure is the full `CricketMatchRules` form, grouped into:
   - Overs & players
   - Extras
   - Result rules: tie resolution, draw allowed, follow-on margin, DLS
   - Conditions: ball type, pitch type
   - Powerplay, a text field such as `1-6`
2. **Toss:** who won (a team toggle) and elected to **Bat / Bowl**.
3. **XIs:** one tab per team.
   - A "Same as last match vs {opponent}" button fills from `lastSquad`.
   - Each player row has Playing / Bench / Out, a **C** (captain) toggle pre-selected from the
     team's `defaultCaptainPlayerId`, a **WK** toggle (suggest wicket-keeper roles first), and a
     batting-order number. Batting order uses reorder handles, or tap-to-number, pre-filled from
     `battingOrderPreference`.
   - Show the role label and bowling style as secondary text.
   - Validate for exactly `playersPerSide` playing, one captain and one keeper per side, and let the
     server have the final word.
4. **Confirm** calls `CRICKET_SETUP` and moves to Live, where the first action is Start innings.

### 6.10 Cricket scoring console (second most important screen)

**Header:**

- `battingTeamName`, then the huge `runs/wickets`, then overs `(14.3/20)`.
- The run rate. When chasing, add the target, "Need 42 off 33", and the required run rate.
- A FREE HIT badge when `freeHitPending`.
- A DLS strip when `dls` is present: par score and runs ahead of or behind par.

**Crease card:**

- Striker (marked ●) and non-striker, each with runs(balls), 4s and 6s.
- The bowler with O-M-R-W.
- The partnership.

**This over:** a row of ball chips from `thisOver[].display`. A boundary chip is accent-coloured, a
wicket chip is red "W", and extras are small ("wd", "nb2", "1b").

**Run pad (bottom, big):**

- **0 1 2 3 4 6**, plus a "5+/more" option.
- Modifier toggles: **Wide · No ball · Byes · Leg byes**. Byes and leg byes only appear if the
  rules allow them.
- A **WICKET** button in red.
- Tapping a run with no modifier records it at once. With a modifier, the number means the extra
  runs. This maps onto `RecordBallRequest`:
  - Wide with 2 runs sends `isWide: true, wideExtraRuns: 2`.
  - No ball with 4 off the bat sends `isNoBall: true, runsOffBat: 4`.
  - Leg byes of 1 sends `legByes: 1`.

**Wicket sheet:**

- Dismissal types come **only from `actions.possibleDismissals`**.
- Next, the dismissed batter (striker or non-striker, which matters for run-outs).
- Then the fielder, only when the type takes one (Caught, RunOut, Stumped).
- Run out adds a "Direct hit" switch, a receiver when it isn't a direct hit, and runs completed
  before the run-out.
- Caught asks "Batters crossed?".

**Blocking pickers:** when `needsBatter` or `needsBowler` is set, open a bottom sheet that the user
cannot dismiss, listing `availableBatters` or `availableBowlers`. Bowlers show their overs so far,
and the previous bowler is excluded by the server.

**Toolbar/overflow:**

- **Undo last ball** (`canUndo`). Undo is always one tap away and never confirmed.
- Reduce overs (rain) (`canReduceOvers`).
- Declare (`canDeclare`), End innings or Abandon (`canEndInnings`).
- Enforce follow-on, Start super over, and Complete match (`canComplete`, with No result or Award
  to team options).
- Scorecard.

**Between innings (`InningsBreak`):** a summary card of the finished innings, then **Start innings
2**. The batting side comes from `nextBattingTeamId`, and the user picks the striker, non-striker
and opening bowler.

**Completed:** `resultSummary` in a large banner, with a link to the scorecard.

### 6.11 Cricket scorecard

- An innings switcher.
- Batting table: batter, dismissal text, R B 4s 6s SR, with the current batters highlighted.
- The extras breakdown, and the total with overs and run rate.
- Fall of wickets.
- Bowling table: O M R W Econ wd nb.
- The toss summary and the result at the top.

## 7. API contract (base `{server}/api/`)

Add each endpoint to `routes.ts` under the given ID. The **source of truth is the controller code
in `../TournamentScheduler.Api/Controllers`**, together with the models in `../TournamentScheduler.Api/Models`.
Read them for exact shapes before typing a screen, and trust them over this table if they disagree.

| Service ID | Method & path | Body / notes |
|---|---|---|
| HEALTH_CHECK | GET `health` | exists |
| TOURNAMENT_LIST | GET `tournaments?sport=` | exists |
| TOURNAMENT_CREATE | POST `tournaments` | `{name, sport}` (exists) |
| TOURNAMENT_GET | GET `tournaments/{id}` | |
| TOURNAMENT_DELETE | DELETE `tournaments/{id}` | 204 |
| TOURNAMENT_START | POST `tournaments/{id}/start` | returns `{matchesCreated}`; 400 if already started or no active schedule |
| TOURNAMENT_MATCHES | GET `tournaments/{id}/matches` | card rows; shape differs by sport (see `TournamentsController.GetMatches`) |
| TOURNAMENT_STATS | GET `tournaments/{id}/stats` | football `TournamentStats` |
| TOURNAMENT_CRICKET_STATS | GET `tournaments/{id}/cricket-stats` | `CricketTournamentStats` |
| SCHEDULE_ACTIVE | GET `tournaments/{id}/schedule` | active `SavedSchedule`; 404 = none yet |
| SCHEDULE_HISTORY | GET `tournaments/{id}/schedules` | last 5 |
| SCHEDULE_ACTIVATE | POST `tournaments/{tournamentId}/schedules/{scheduleId}/activate` | |
| TOURNAMENT_GROUPS_RANDOMIZE | POST `tournament/groups/randomize` | `{teamNames[], groupCount}` → `{groups:[{name,teams[]}]}` |
| TOURNAMENT_GROUPS_MANUAL | POST `tournament/groups/manual` | `{groups:[{name,teams[]}]}` (validates duplicates) |
| TOURNAMENT_SCHEDULE_GENERATE | POST `tournament/schedule` | `{groups, matchesPerTeam, allowRepeatFixtures}` → `TournamentSchedule` |
| TOURNAMENT_SCHEDULE_APPROVE | POST `tournament/schedule/approve` | `{tournamentId, schedule}` → `{savedScheduleId}` |
| TEAM_LIST | GET `tournaments/{tournamentId}/teams` | teams with players (+ cricket profile) |
| TEAM_GET | GET `tournaments/{tournamentId}/teams/{teamId}` | |
| TEAM_CREATE | POST `tournaments/{tournamentId}/teams` | `{name}`; 409 duplicate |
| TEAM_UPDATE | PUT `tournaments/{tournamentId}/teams/{teamId}` | `{name, defaultCaptainPlayerId, setCaptain}` |
| TEAM_DELETE | DELETE `tournaments/{tournamentId}/teams/{teamId}` | |
| PLAYER_CREATE | POST `tournaments/{tournamentId}/teams/{teamId}/players` | `{name, position?, jerseyNumber?, cricket?}` |
| PLAYER_UPDATE | PUT `tournaments/{tournamentId}/teams/{teamId}/players/{playerId}` | same; omit `cricket` to leave the profile alone |
| PLAYER_DELETE | DELETE `…/players/{playerId}` | |
| MATCH_GET | GET `matches/{id}` | full `Match` incl. derived flags, `matchPlayers`, `homeTeam.players`, `awayTeam.players` |
| MATCH_SETUP | POST `matches/{id}/setup` | `StartMatchRequest`; starts the clock; 409 if another match is live |
| MATCH_EVENT_RECORD | POST `matches/{id}/events` | `{eventType, teamId, playerId?, relatedPlayerId?}`: Goal, YellowCard, RedCard, SubstitutionIn only |
| MATCH_EVENTS | GET `matches/{id}/events` | timeline, oldest first |
| MATCH_CLOCK_PAUSE | POST `matches/{id}/clock/pause` | |
| MATCH_CLOCK_RESUME | POST `matches/{id}/clock/resume` | |
| MATCH_CLOCK_ADD_TIME | POST `matches/{id}/clock/add-time` | `{minutes}` |
| MATCH_PERIOD_END | POST `matches/{id}/half/end` | |
| MATCH_PERIOD_NEXT | POST `matches/{id}/half/next` | |
| MATCH_COMPLETE | POST `matches/{id}/complete` | `{force?, awardWinnerTeamId?}` |
| MATCH_PENALTIES_START | POST `matches/{id}/penalties/start` | `{takersPerSide}` |
| MATCH_PENALTIES_GET | GET `matches/{id}/penalties` | kicks, scores, `outcome`, `nextTeamId`, available taker ids |
| MATCH_PENALTY_KICK | POST `matches/{id}/penalties/kick` | `{teamId, playerId, scored}` |
| MATCH_PENALTIES_END | POST `matches/{id}/penalties/end` | `{winningTeamId}` |
| CRICKET_MATCH_GET | GET `cricket-matches/{id}` | `CricketMatchStateDto` |
| CRICKET_SETUP_OPTIONS | GET `cricket-matches/{id}/setup-options` | presets, `lastFormat`, teams with players + `lastSquad` |
| CRICKET_SETUP | POST `cricket-matches/{id}/setup` | `{preset? , rules?, tossWinnerTeamId, tossDecision, squad[]}` |
| CRICKET_INNINGS_START | POST `cricket-matches/{id}/innings/start` | `{strikerId, nonStrikerId, bowlerId, oversLimit?}` |
| CRICKET_BALL_RECORD | POST `cricket-matches/{id}/balls` | `RecordBallRequest` |
| CRICKET_BALL_UNDO | POST `cricket-matches/{id}/balls/undo` | |
| CRICKET_BATTER_SET | POST `cricket-matches/{id}/batter` | `{playerId}` |
| CRICKET_BOWLER_SET | POST `cricket-matches/{id}/bowler` | `{playerId}` |
| CRICKET_INNINGS_END | POST `cricket-matches/{id}/innings/end` | `{reason: "Declared" \| "Abandoned"}` |
| CRICKET_REDUCE_OVERS | POST `cricket-matches/{id}/innings/reduce-overs` | `{newOversLimit}` |
| CRICKET_FOLLOW_ON | POST `cricket-matches/{id}/follow-on` | |
| CRICKET_SUPER_OVER_START | POST `cricket-matches/{id}/super-over/start` | |
| CRICKET_COMPLETE | POST `cricket-matches/{id}/complete` | `{force?, awardWinnerTeamId?, noResult?}` |
| CRICKET_SCORECARD | GET `cricket-matches/{id}/scorecard` | `CricketScorecardDto` |
| CRICKET_BALLS | GET `cricket-matches/{id}/balls` | full ball-by-ball |
| CRICKET_EVENTS | GET `cricket-matches/{id}/events` | non-ball timeline |

## 8. Code organisation

- Keep screens thin. Put data loading in hooks under `src/hooks/` (for example
  `useTournament(id)`, `useFootballMatch(id)` with polling, and `useCricketMatch(id)`). Put
  reusable UI in `src/components/`:
  - `ScoreBoard`, `MatchCard`, `StatusChip`, `Stepper`, `SegmentedControl`, `Sheet`,
    `PlayerPicker`, `ConfirmDialog`, `EmptyState`, `Skeleton`, `StandingsTable`, `LeaderBoard`
  - `BallChip`, `RunPad`
- Theme every screen inside a tournament with `themeFor(sport)` through a small
  `SportThemeProvider`, so no child component has to be passed the sport.
- Match the existing code style: short "why" comments at the top of files and above anything
  non-obvious, and no commented-out code.
- Accessibility:
  - every pressable has an `accessibilityLabel` ("Goal for Rovers")
  - headers have `accessibilityRole="header"`
  - the live score is announced on change
  - dynamic type doesn't break layouts

## 9. Web reference files (behaviour to mirror)

| Mobile screen | Web source in `../tournament-scheduler-ui/src/` |
|---|---|
| Hub, groups, schedule wizard, start | `App.jsx`, `Home.jsx` |
| Teams and players | `TeamManagement.jsx` |
| Match list | `MatchList.jsx` |
| Football setup / live / penalties | `MatchSetup.jsx`, `LiveMatch.jsx`, `PenaltyShootout.jsx` |
| Football stats | `TournamentStats.jsx` |
| Cricket setup / live / scorecard / stats | `cricket/CricketMatchSetup.jsx`, `CricketLiveMatch.jsx`, `CricketScorecard.jsx`, `CricketStats.jsx`, `cricketLabels.js` |
| Wording of errors | `api/errors.js` (already ported) |

## 10. How to work

1. **Plan first.** Enter plan mode, read the files above, and propose the route tree, the shared
   components and the phase order. Wait for my approval.
2. **Build in phases.** Stop after each one, run `npx tsc --noEmit` and `npx expo lint`, fix
   everything, and tell me what to test on the phone.
   - **Phase 1:** routes/types/hooks, tournament hub (both states), teams and players, and the
     schedule wizard and start.
   - **Phase 2:** match list, football setup, live console and penalties.
   - **Phase 3:** cricket setup, scoring console and scorecard.
   - **Phase 4:** the stats and table tabs for both sports.
   - **Phase 5:** polish, which covers skeletons, empty states, haptics, motion, accessibility,
     and a small-screen check at 360×640.
3. Before writing Expo API code, check the SDK 57 docs as `AGENTS.md` instructs. Do not rely on
   memory.
4. Never change the API project. If the app needs something the API doesn't provide, stop and tell
   me what, and why.
5. Don't commit. I'll review and commit myself.

**Definition of done:** a tournament of either sport can be taken on the phone from creation
through teams, schedule, start, every match scored to completion, and final table and stats. It
must work with no web app open, every server rule message must show clearly, and typecheck and lint
must pass.
