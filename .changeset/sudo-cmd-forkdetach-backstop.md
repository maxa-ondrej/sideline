---
"@sideline/bot": patch
---

Add a terminal `catchCause` backstop to the `/sudo` command's deferred-reply fork. Its tagged errors were well handled, but an untagged defect (e.g. a server-side `LogicError.die`) could still leave the deferred reply unresolved ("Sideline is thinking…"). Resolves it with the existing `bot_sudo_err_generic`, mirroring the event-create backstop.
