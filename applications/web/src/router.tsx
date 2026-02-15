import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import type { AuthUser } from "./lib/auth"
import { routeTree } from "./routeTree.gen"

export interface RouterContext {
  user: AuthUser | null
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    context: {
      user: null,
    },
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
