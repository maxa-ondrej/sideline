---
'@sideline/server': patch
'@sideline/web': patch
'@sideline/i18n': patch
---

Fix removed users retaining access to old teams. `TeamMembersRepository.findMembershipByIds` now filters inactive memberships by default, closing access through every endpoint that gates on team membership. Notification endpoints (`listNotifications`, `markAsRead`, `markAllAsRead`) now require active membership. iCal fee feed and payment-reminder cron exclude inactive members. `auth.autoJoinTeams` treats deactivation as terminal — removed users must rejoin via fresh invite. Web shows a new `/no-team` page for 0-team users with an optional "you were removed" banner; team-detail routes redirect removed users instead of 404ing.
