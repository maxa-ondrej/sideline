---
"@sideline/domain": patch
"@sideline/server": patch
"@sideline/web": patch
"@sideline/i18n": patch
---

Fix channel access management for groups not yet set up in Discord. Granting a
group whose Discord role was not yet resolvable silently saved the grant but
never applied a Discord permission overwrite and gave no feedback — so adding a
second (un-provisioned) group appeared to do nothing. Channel detail responses
now expose a per-grant `roleResolvable` flag, and the channel access sheet shows
a "Not yet active in Discord" badge, an info notice, and a clearer toast so the
saved-but-pending state is visible. The access still self-heals once the group
is provisioned in Discord.
