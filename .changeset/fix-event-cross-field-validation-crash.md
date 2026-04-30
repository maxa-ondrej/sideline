---
'@sideline/domain': patch
'@sideline/server': patch
'@sideline/bot': patch
'@sideline/web': patch
'@sideline/migrations': patch
'@sideline/i18n': patch
---

Fix a crash that prevented creating or updating events and event series unless every optional field was filled in. The cross-field validation that links the new "location link" feature to the location text was reading internal Option markers without first checking that the field was present, which threw `TypeError: Cannot read properties of undefined (reading '_tag')` whenever the location link or location text was empty. The check now correctly evaluates each field's state and only rejects payloads that set a location link without a location text.
