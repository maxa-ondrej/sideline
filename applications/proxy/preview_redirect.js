/**
 * njs script for proxying Discord OAuth callbacks to preview deployments.
 *
 * If the `state` query-parameter contains a `redirectUrl` whose origin differs
 * from the configured FRONTEND_URL, we 302-redirect the entire callback to that
 * origin so the preview deployment's own server handles the token exchange.
 *
 * When origins match (or the state is unparseable) we fall through and let nginx
 * proxy the request to the local server as usual.
 */

function callback(r) {
  var frontendUrl = r.variables.frontend_url;
  var stateRaw = r.args.state;

  if (!stateRaw || !frontendUrl) {
    r.internalRedirect('@server_backend');
    return;
  }

  try {
    const state = JSON.parse(stateRaw);
    const redirectUrl = state.redirectUrl;

    if (!redirectUrl) {
      r.internalRedirect('@server_backend');
      return;
    }

    // Extract origin from redirectUrl (scheme + host + port)
    const match = redirectUrl.match(/^(https?:\/\/[^/]+)/);
    if (!match) {
      r.internalRedirect('@server_backend');
      return;
    }

    const redirectOrigin = match[1].replace(/\/$/, '');
    const frontendOrigin = frontendUrl.replace(/\/$/, '');

    if (redirectOrigin === frontendOrigin) {
      r.internalRedirect('@server_backend');
      return;
    }

    // Different origin — redirect to the preview deployment's callback
    const target =
      redirectOrigin +
      '/api/auth/callback?code=' +
      encodeURIComponent(r.args.code || '') +
      '&state=' +
      encodeURIComponent(stateRaw);

    r.return(302, target);
  } catch (e) {
    console.error(e);
    // Malformed state — let the server handle it (it will return an error)
    r.internalRedirect('@server_backend');
  }
}

export default { callback };
