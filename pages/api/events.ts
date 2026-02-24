/**
 * SSE proxy — Pages Router API route (not App Router).
 *
 * Pages Router gives us direct access to Node.js req/res, so we can use
 * res.write() + res.flush() for true server-sent events without buffering.
 *
 * The App Router's Response streaming buffers in production; Pages Router doesn't.
 */

import type { NextApiRequest, NextApiResponse } from 'next'

const PAUL_URL = process.env.PAUL_AGENT_URL ?? 'http://paul-prod.eba-gjxwvw3i.us-east-1.elasticbeanstalk.com'
const API_KEY  = process.env.PAUL_API_KEY  ?? ''

// Disable Next.js body parsing (not needed for GET SSE)
export const config = { api: { bodyParser: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // SSE headers — flush immediately so the client knows the stream is open
  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache, no-transform')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  const dec = new TextDecoder()

  const cleanup = () => {
    reader?.cancel().catch(() => {})
    res.end()
  }

  // Flush helper — works with both compression middleware and plain Node.js res
  const flush = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = res as any
    if (typeof r.flush === 'function') r.flush()
    else if (r.socket?.flush) r.socket.flush()
  }

  req.on('close',   cleanup)
  req.on('aborted', cleanup)

  try {
    const upstream = await fetch(`${PAUL_URL}/events?key=${API_KEY}`, {
      headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
    })

    if (!upstream.body) { res.end(); return }

    reader = upstream.body.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (res.writableEnded) break

      const text = dec.decode(value, { stream: true })
      res.write(text)
      flush()
    }
  } catch (err) {
    if (!res.writableEnded) {
      res.write('event: error\ndata: {}\n\n')
      flush()
    }
  } finally {
    reader?.releaseLock()
    if (!res.writableEnded) res.end()
  }
}
