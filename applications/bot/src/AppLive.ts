import { DiscordIxLive } from "dfx/gateway"
import { Layer } from "effect"
import { HealthServerLive } from "./HealthServerLive.js"

export const AppLive = Layer.mergeAll(DiscordIxLive, HealthServerLive)
