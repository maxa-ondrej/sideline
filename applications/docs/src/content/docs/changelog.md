---
title: Changelog
description: User-facing changes to Sideline.
---

This page lists user-visible changes to Sideline. For developer-level release notes, see the GitHub repository.

## 2026-04 — RSVP reminder no longer pings a role

- The RSVP reminder post is now a quiet embed. It no longer @-mentions the member group's Discord role. The bot still sends a direct message to each non-responder who has a linked Discord account.
- The **"Starting now"** event-start announcement continues to @-mention the member group's Discord role as before.

## 2026-04 — Configurable reminders

- Reminders are now fully configurable per team. You can set how many days before an event the reminder fires, what time of day (evaluated in the team's timezone), and which Discord channel receives it.
- Reminders and event-start announcements now go to a dedicated **reminders channel** you configure in Team settings. If no channel is set, the bot falls back to the event's owner-group channel.
- When an event starts, the bot posts a fresh **"Starting now"** announcement to the reminders channel with the going list and a role @-mention — in addition to updating the original event embed.

## 2026-04 — Documentation site launched

- New `/docs` site with role-based quick starts, guides, FAQ, and API overview.
- English content is the source of truth. Czech translations fall back to English with a notice and will be added page-by-page.
