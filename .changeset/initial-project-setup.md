---
'@sideline/bot': minor
'@sideline/server': minor
'@sideline/domain': minor
'@sideline/migrations': minor
---

Initial project setup

- Add Discord OAuth login flow with session and user management
- Add typed frontend runtime with ApiClient context and ClientError
- Add env-aware runMain for bot and server (JSON logger in production, pretty logger in development)
- Add Dockerfiles and Docker CI workflow for all applications
- Migrate Vitest to root test.projects configuration
- Refactor app layers into AppLive + run.ts pattern
- Add Swagger UI and OpenAPI docs to server
- Add shadcn/ui components to web app
