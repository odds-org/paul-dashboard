/**
 * SSE endpoint — polls n8n for new DoradoBet executions every 3s
 * and streams them as analytics events to the dashboard.
 *
 * n8n doesn't have native SSE, so we poll the executions API.
 * For each new execution we fetch full data to get userId, message, skill.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchExecutions, fetchExecution, parseExecution } from '../../lib/n8n'

export const config = { api: { bodyParser: false } }

const POLL_INTERVAL_MS = 4000
const HEARTBEAT_MS     = 30_000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache, no-transform')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const flush = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = res as any
    if (typeof r.flush === 'function') r.flush()
  }

  let closed = false
  req.on('close',   () => { closed = true })
  req.on('aborted', () => { closed = true })

  // Send connected event
  res.write(`event: connected\ndata: {"source":"n8n","workflowId":"kfygpNYbIAvN6v8l"}\n\n`)
  flush()

  // Get latest execution ID as the starting point
  let lastKnownId = 0
  try {
    const { data } = await fetchExecutions(1)
    if (data[0]) lastKnownId = parseInt(data[0].id, 10)
  } catch { /* start from 0 */ }

  // Poll loop
  const pollTimer = setInterval(async () => {
    if (closed || res.writableEnded) { clearInterval(pollTimer); clearInterval(hbTimer); return }

    try {
      const { data: executions } = await fetchExecutions(10)
      const newExecs = executions.filter(ex => parseInt(ex.id, 10) > lastKnownId)

      if (!newExecs.length) return

      // Update last known
      lastKnownId = Math.max(...newExecs.map(ex => parseInt(ex.id, 10)))

      // Fetch full data for each new execution and emit
      for (const ex of newExecs.reverse()) {
        if (closed || res.writableEnded) break
        try {
          const full   = await fetchExecution(ex.id)
          const parsed = parseExecution(full)

          const event = {
            correlationId:     parsed.id,
            userId:            parsed.userId,
            sessionId:         parsed.sessionId,
            clientId:          'n8n',
            firstMessage:      false,
            hasMemoryFile:     false,
            isFirstMsgOfDay:   false,
            skillActivated:    parsed.skillActivated,
            toolsUsed:         [] as string[],
            toolCallsCount:    0,
            webSearchUsed:     false,
            requestDurationMs: parsed.durationMs,
            errorOccurred:     parsed.errorOccurred,
            outputType:        'text',
            outputLength:      parsed.messageOut.length,
            createdAt:         parsed.startedAt,
            messageIn:         parsed.messageIn,
            messageOut:        parsed.messageOut,
          }

          res.write(`event: analytics\ndata: ${JSON.stringify(event)}\n\n`)
          flush()
        } catch { /* skip failed full fetch */ }
      }
    } catch { /* skip failed poll */ }
  }, POLL_INTERVAL_MS)

  // Heartbeat to keep connection alive
  const hbTimer = setInterval(() => {
    if (closed || res.writableEnded) { clearInterval(pollTimer); clearInterval(hbTimer); return }
    res.write('event: heartbeat\ndata: {}\n\n')
    flush()
  }, HEARTBEAT_MS)
}
