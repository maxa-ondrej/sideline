---
'@sideline/web': patch
---

Replace `Effect.succeed(value as T)` widening casts with explicit type arguments (`Effect.succeed<T>(value)`) in the onboarding-token, my-payments, roster-detail, and onboarding-page loaders. Behavior-preserving — same value, annotation instead of assertion.
