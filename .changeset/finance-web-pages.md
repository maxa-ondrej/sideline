---
'@sideline/domain': minor
'@sideline/server': minor
'@sideline/web': minor
'@sideline/i18n': minor
---

Add web UI for fee management and payment tracking. Captains and treasurers can now define, edit, and archive fees from a new `Fees` page, and the existing finance overview gains an `By assignment` tab listing every fee assignment with filters (status, fee, player, search), inline Record Payment / Mark Waived / Un-waive actions, and per-currency outstanding amounts. Adds query filters (`memberId`, `feeId`, `from`, `to`, `includeVoided`) to `listPayments` and a new `listMemberAssignments` HTTP endpoint scoped by team ownership.
