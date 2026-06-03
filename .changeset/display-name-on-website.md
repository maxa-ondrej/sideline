---
'@sideline/domain': patch
'@sideline/server': patch
'@sideline/web': patch
'@sideline/bot': patch
---

Show a consistent, server-resolved display name for users across the website. The name-selection logic that previously lived only in the Discord bot is now a shared `DisplayName.pickDisplayName` helper in `@sideline/domain`, computed server-side and returned as a `displayName` field on the `CurrentUser`, `RosterPlayer`, `LeaderboardEntry`, RSVP (`RsvpEntry`/`NonResponderEntry`), and group-member API responses. The web app now renders that field everywhere it shows a person's name (nav menu, profile, leaderboard, rosters, team members, player detail, group members, RSVP panel, fee/challenge assignee pickers) instead of ad-hoc fallbacks — fixing the leaderboard, which previously showed the raw Discord username with no fallback to the user's real name.

Precedence is profile name → Discord nickname → Discord display name → username. Empty/whitespace-only Discord name strings are now skipped (also fixes a latent bot bug). Also fixes the weekly-summary top-contributor name, which was previously a placeholder team-member id.
