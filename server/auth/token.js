import axios from 'axios'

let accessToken   = null
let tokenExpiry   = null
let refreshToken  = null

export async function getToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken
  }

  // Use refresh token if available
  if (refreshToken) {
    try {
      const res = await axios.post(
        'https://acleddata.com/oauth/token',
        new URLSearchParams({
          refresh_token: refreshToken,
          grant_type:    'refresh_token',
          client_id:     'acled',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
      accessToken  = res.data.access_token
      refreshToken = res.data.refresh_token
      tokenExpiry  = Date.now() + (res.data.expires_in - 300) * 1000
      console.log('[token] refreshed successfully')
      return accessToken
    } catch (err) {
      console.log('[token] refresh failed, re-authenticating...')
    }
  }

    // Full authentication
    try {
    const res = await axios.post(
        'https://acleddata.com/oauth/token',
        new URLSearchParams({
        username:   process.env.ACLED_EMAIL,
        password:   process.env.ACLED_PASSWORD,
        grant_type: 'password',
        client_id:  'acled',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    accessToken  = res.data.access_token
    refreshToken = res.data.refresh_token
    tokenExpiry  = Date.now() + (res.data.expires_in - 300) * 1000
    console.log('[token] authenticated successfully')
    return accessToken
    } catch (err) {
    console.error('[token] auth failed:', err.response?.status)
    console.error('[token] error data:', JSON.stringify(err.response?.data))
    console.error('[token] email used:', process.env.ACLED_EMAIL)
    throw err
    }

  accessToken  = res.data.access_token
  refreshToken = res.data.refresh_token
  tokenExpiry  = Date.now() + (res.data.expires_in - 300) * 1000
  console.log('[token] authenticated successfully')
  return accessToken
}