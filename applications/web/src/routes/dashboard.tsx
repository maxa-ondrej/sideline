import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/" })
    }
  },
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useRouteContext()

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.discordUsername}!</p>
    </div>
  )
}
