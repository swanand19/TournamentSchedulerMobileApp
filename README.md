# Tournament Scheduler — mobile app

The scorer's app for football and cricket tournaments, built with Expo (SDK 57) and Expo Router.
It talks to the same ASP.NET Core API as the website, hosted in IIS on the laptop.

## Run it on your Android phone

1. **API running in IIS.** Once, as administrator:
   `TournamentScheduler.Api\deploy\Setup-IisSite.ps1`. It prints the address to use, e.g.
   `http://192.168.1.14:5080`.
2. **Phone and laptop on the same Wi-Fi.**
3. **Install Expo Go** from the Play Store.
4. **Start the app server** on the laptop:
   ```bash
   cd tournament-scheduler-mobile
   npx expo start
   ```
   The first time, Windows asks whether Node.js may use the network: allow **Private networks**.
   The phone loads the app from the laptop on port 8081.
5. **Scan the QR code** with Expo Go.
6. If the laptop's IP has changed, tap **Server** on the home screen, enter the new address, then
   **Test connection** and **Save**.

The first-run default address lives in `.env.local` (`EXPO_PUBLIC_API_BASE_URL`), which is not committed.

## Checks before calling anything done

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo-doctor      # dependency and config health
```

## Layout

| Path | What it is |
| --- | --- |
| `src/app/` | Screens (Expo Router: every file is a route) |
| `src/api/client.ts` | The only way the app calls the API: `api.call("SERVICE_ID", {...})` |
| `src/api/routes.ts` | Service IDs → API routes (replaced by the encrypted gateway later) |
| `src/config/server.tsx` | The saved server address and the connection test |
| `src/api/types.ts` | TypeScript shapes of every API response (mirrors `TournamentScheduler.Api/Models`) |
| `src/theme/theme.ts` | Colours, fonts, spacing and type scale shared by every screen |
| `src/theme/SportTheme.tsx` | Re-tints everything inside a tournament to football green or cricket navy |
| `src/components/` | Shared UI: `Button`, `Card`/`Deck`, `Sheet` (drag-to-dismiss bottom sheet), `SegmentedControl`, `PlayerGrid`, `Stepper`, `Bump` (score punch), `LiveDot`, `Skeleton`… |
| `src/hooks/` | `useQuery` (load, refresh, focus reload, polling), `useAction` (double-tap-proof mutations), `useTournament` |
| `src/features/` | Screen parts by area: `hub/`, `teams/`, `matches/`, `football/`, `cricket/` |
| `src/lib/` | Haptics, confirm dialogs, formatting, cricket labels |

### Screens (`src/app/`)

| Route | Screen |
| --- | --- |
| `index` | Tournaments, by sport |
| `server` | Server address (form sheet) |
| `tournament/[id]` | Hub: setup checklist before kick-off; Matches · Table · Stats · Teams after |
| `tournament/[id]/teams`, `team/[teamId]` | Teams, squads, add/edit player |
| `tournament/[id]/schedule`, `history` | Groups & schedule wizard, saved schedules |
| `tournament/[id]/football/[matchId]/setup` · `live` · `penalties` | Football rules & line-ups, scoring console, shootout |
| `tournament/[id]/cricket/[matchId]/setup` · `live` · `scorecard` | Cricket format/toss/XIs, ball-by-ball console, scorecard |

Every rule (what can be pressed right now) comes from the server — the football match's flow flags
and the cricket state's `actions`. Screens only draw them.
