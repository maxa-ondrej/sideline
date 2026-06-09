---
"@sideline/server": patch
---

fix(email): make the short AI summary a proper 5-7 emoji bullet list, not a single sentence

The short email summary was collapsing into one opener sentence instead of the intended scannable bullets. The LLM prompt now requires a 5-7 emoji-led bullet list (one short context line optional, never a replacement for the bullets).
