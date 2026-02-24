---
'@sideline/domain': minor
'@sideline/server': minor
'@sideline/migrations': minor
---

Add proper Roster entity with many-to-many team member membership

Teams can now have multiple named rosters (e.g. per-event). Each roster has a name, active flag, and a set of team members. New API endpoints for full roster CRUD plus add/remove member operations. Player-pool endpoints renamed from /roster/* to /members/*.
