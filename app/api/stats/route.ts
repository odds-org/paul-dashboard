import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PAUL_URL = process.env.PAUL_AGENT_URL ?? 'http://paul-prod.eba-gjxwvw3i.us-east-1.elasticbeanstalk.com'
const API_KEY  = process.env.PAUL_API_KEY  ?? ''

export async function GET() {
  try {
    const res = await fetch(`${PAUL_URL}/stats?key=${API_KEY}`, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: res.status })
    return NextResponse.json(await res.json())
  } catch (err) {
    console.error('[Dashboard] stats proxy error:', err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
