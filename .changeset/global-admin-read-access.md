---
"@sideline/server": patch
---

Grant global admins read-only access to any team without requiring membership. Adds a `requireReadAccess` helper that returns a synthetic membership with view permissions when a global admin is not a member, and unions view permissions onto the real membership when they are. Swapped into all read-only handlers across roster, role, finance, activity-stats, and team endpoints.
