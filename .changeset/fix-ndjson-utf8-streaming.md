---
"@sideline/bot": patch
"@sideline/server": patch
---

fix(rpc): preserve UTF-8 multi-byte characters across NDJSON stream chunk boundaries

Patches the `effect` NDJSON RPC serializer to decode streamed response chunks with a streaming `TextDecoder` (`{ stream: true }`). Previously, when an HTTP response body was split mid-character across network chunks, multi-byte UTF-8 sequences (e.g. Czech accented letters, emoji) were flushed as U+FFFD replacement characters, corrupting forwarded email summaries posted to Discord.
