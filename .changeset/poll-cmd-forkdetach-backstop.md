---
"@sideline/bot": patch
---

Add a terminal `catchCause` backstop to the `/poll` command's deferred-reply fork. Its tail combined `RpcClientError` + REST, so only an untagged defect (`CreatePoll`/`SavePollMessageId` die, or a `buildPollEmbed` throw) could leave the deferred reply unresolved ("Sideline is thinking…"). Resolves it with the existing `bot_poll_err_generic`, mirroring the event-create backstop.
