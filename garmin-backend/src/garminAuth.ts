import crypto from 'crypto'

const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauth2Confirm'
// OAuth 2.0 PKCE token exchange (pairs with oauth2Confirm)
const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token'

// PKCE: generate code_verifier (43–128 chars) and code_challenge = base64url(sha256(verifier))
export function generatePKCE(): { codeVerifier: string; codeChallenge: string; state: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const hash = crypto.createHash('sha256').update(codeVerifier).digest()
  const codeChallenge = hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const state = crypto.randomBytes(16).toString('hex')
  return { codeVerifier, codeChallenge, state }
}

export function buildAuthUrl(params: {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string
}): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    state: params.state,
  })
  return `${GARMIN_AUTH_URL}?${q.toString()}`
}

export async function exchangeCodeForToken(params: {
  clientId: string
  clientSecret: string
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
  })

  const res = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
}
