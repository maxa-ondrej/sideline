import { FetchHttpClient, HttpApi, HttpApiClient } from "@effect/platform"
import { AuthApiGroup, type CurrentUser } from "@sideline/domain/AuthApi"
import { Effect, Layer } from "effect"

const API_URL = "http://localhost:3001"

export type AuthUser = typeof CurrentUser.Type

class ClientApi extends HttpApi.make("api").add(AuthApiGroup) {}

const HttpLive = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" as const })),
)

const client = HttpApiClient.make(ClientApi, { baseUrl: API_URL }).pipe(Effect.provide(HttpLive))

export function fetchCurrentUser(): Promise<AuthUser | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  return client.pipe(
    Effect.flatMap((c) => c.auth.me()),
    Effect.catchAll(() => Effect.succeed(null as AuthUser | null)),
    Effect.runPromise,
  )
}

export function getLoginUrl(): string {
  return `${API_URL}/auth/login`
}

export function logout(): Promise<void> {
  return client.pipe(
    Effect.flatMap((c) => c.auth.logout()),
    Effect.catchAll(() => Effect.void),
    Effect.runPromise,
  )
}
