---
"@sideline/server": patch
"@sideline/bot": patch
"@sideline/domain": patch
"@sideline/i18n": patch
---

fix(carpool): add a persistent Leave button and unbold thread titles

Passengers could only leave a car from the ephemeral reserve-confirmation message,
which disappears once dismissed. There is now a persistent "Leave car" button in each
car's private thread (next to the owner's Assign/Remove controls) and a single shared
"Leave my car" button on the main board. The board button is backed by a new
`Carpool/LeaveCarpool` RPC that resolves the member's seat by carpool (a member is in at
most one car per carpool) and removes them from the right thread.

Carpool thread titles also no longer render literal `**asterisks**` — the thread name now
uses the plain display name, while the welcome embed body keeps bold formatting.
