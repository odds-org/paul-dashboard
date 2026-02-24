import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PAUL_URL = process.env.PAUL_AGENT_URL ?? 'http://paul-prod.eba-gjxwvw3i.us-east-1.elasticbeanstalk.com'
const API_KEY  = process.env.PAUL_API_KEY  ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const session = searchParams.get('session') ?? ''
  const user    = searchParams.get('user')    ?? ''

  const params = new URLSearchParams({ key: API_KEY })
  if (session) params.set('session', session)
  if (user)    params.set('user', user)

  try {
    const res = await fetch(`${PAUL_URL}/conversations?${params}`, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: res.status })
    return NextResponse.json(await res.json())
  } catch (err) {
    console.error('[Dashboard] conversations proxy error:', err)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}
