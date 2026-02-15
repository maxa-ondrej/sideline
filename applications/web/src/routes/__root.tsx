import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { fetchCurrentUser } from "../lib/auth"
import type { RouterContext } from "../router"

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const user = await fetchCurrentUser()
    console.log("user", user)
    return { user }
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sideline</title>
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  )
}
