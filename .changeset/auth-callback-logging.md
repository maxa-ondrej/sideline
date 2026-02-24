---
'@sideline/server': patch
---

Add extensive step-by-step logging to the Discord OAuth callback to diagnose auth failures. Logs each stage: callback received, state decoded, token exchange, Discord REST client, getMyUser result, DB upsert, and session creation. ErrorResponse and RatelimitedResponse from the Discord API now log the full error before returning the auth_failed redirect.
