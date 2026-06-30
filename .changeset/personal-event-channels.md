---
"@sideline/domain": minor
"@sideline/server": minor
"@sideline/bot": minor
"@sideline/web": minor
"@sideline/migrations": minor
"@sideline/i18n": minor
"@sideline/docs": minor
---

Rework the Discord events overview into private per-member event channels plus a single global shared channel.

- Each member gets a private Discord channel (inside a configurable category, visible only to them and the bot) showing all their upcoming events as persistent messages with RSVP buttons. Overflow categories are auto-created past Discord's 50-channel cap.
- One global shared events channel (aggregate voting) is configurable in team settings; the per-event channel relation is removed (the event create/edit channel picker is gone).
- Hybrid sync keeps both surfaces consistent: the clicker's message updates instantly, and a bot reconcile loop converges all other personal copies and the global aggregate via a timestamp-guarded dirty marker.
- Removes the old `/event overview` command, the overview-channel team setting, and the SetOverviewChannel RPC. The coaching-status announcement is retained.
