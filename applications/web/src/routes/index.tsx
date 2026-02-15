import { createFileRoute, useRouter } from "@tanstack/react-router"
import { getLoginUrl, logout } from "../lib/auth"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  const router = useRouter()
  const { user } = Route.useRouteContext()

  if (user) {
    return (
      <div>
        <h1>Sideline</h1>
        <p>Signed in as {user.discordUsername}</p>
        <button
          type="button"
          onClick={async () => {
            await logout()
            router.invalidate()
          }}
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1>Sideline</h1>
      <p>Welcome to Sideline.</p>
      <a href={getLoginUrl()}>Sign in with Discord</a>
    </div>
  )
}
