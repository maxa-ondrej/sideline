import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

export default createServerEntry({
  fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/health") {
      return Response.json({ status: "ok" })
    }
    return handler.fetch(request)
  },
})
