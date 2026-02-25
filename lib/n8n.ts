/**
 * n8n API client — reads real DoradoBet agent executions.
 * Workflow: "Doradot Bet [Proactivo]" (kfygpNYbIAvN6v8l)
 */

export const N8N_URL         = process.env.N8N_URL         ?? 'https://n8n.oddsolutions.io'
export const N8N_API_KEY     = process.env.N8N_API_KEY     ?? ''
export const N8N_WORKFLOW_ID = process.env.N8N_WORKFLOW_ID ?? 'kfygpNYbIAvN6v8l'

// ─── Raw n8n types ────────────────────────────────────────────────────────────

export interface N8nExecution {
  id:         string
  status:     'success' | 'error' | 'waiting' | 'running'
  startedAt:  string
  stoppedAt:  string
  mode:       string
  data?:      Record<string, unknown>
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const headers = () => ({ 'X-N8N-API-KEY': N8N_API_KEY })

export async function fetchExecutions(limit = 250, cursor?: string): Promise<{
  data: N8nExecution[]
  nextCursor?: string
}> {
  const p = new URLSearchParams({
    workflowId: N8N_WORKFLOW_ID,
    limit: String(limit),
    includeData: 'false',
  })
  if (cursor) p.set('cursor', cursor)

  const res = await fetch(`${N8N_URL}/api/v1/executions?${p}`, {
    headers: headers(), cache: 'no-store',
  })
  if (!res.ok) throw new Error(`n8n executions ${res.status}`)
  return res.json()
}

export async function fetchExecution(id: string): Promise<N8nExecution> {
  const res = await fetch(
    `${N8N_URL}/api/v1/executions/${id}?includeData=true`,
    { headers: headers(), cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`n8n execution ${id}: ${res.status}`)
  return res.json()
}

// ─── Message extraction helper ────────────────────────────────────────────────
// n8n Respond nodes store the message in 3 different formats:
//   1. json.output = '{"type":"text","data":{"message":"..."}}' (JSON string)
//   2. json.output = {type:"text", data:{message:"..."}}       (JSON object)
//   3. json.paulMessage = '{"type":"json","data":{"message":"..."}}' (JSON string)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMessageFromJson(json: Record<string, any>): string {
  // Try paulMessage (reactivo path uses this key)
  if (json.paulMessage) {
    try {
      const parsed = typeof json.paulMessage === 'string'
        ? JSON.parse(json.paulMessage) : json.paulMessage
      const msg = parsed?.data?.message
      if (msg) return String(msg)
    } catch { /* continue */ }
  }

  // Try output (onboarding + lives paths)
  if (json.output !== undefined) {
    try {
      const parsed = typeof json.output === 'string'
        ? JSON.parse(json.output) : json.output
      const msg = parsed?.data?.message
      if (msg) return String(msg)
    } catch { /* continue */ }
  }

  // Try data.message directly
  if (json.data?.message) return String(json.data.message)

  return ''
}

// ─── Parse execution data ─────────────────────────────────────────────────────

export interface ParsedExecution {
  id:             string
  status:         string
  startedAt:      string
  durationMs:     number
  userId:         string
  sessionId:      string
  messageIn:      string
  messageOut:     string
  skillActivated: string
  errorOccurred:  boolean
}

export function parseExecution(ex: N8nExecution): ParsedExecution {
  const dur = ex.startedAt && ex.stoppedAt
    ? new Date(ex.stoppedAt).getTime() - new Date(ex.startedAt).getTime()
    : 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runData: Record<string, any[]> =
    (ex.data as any)?.resultData?.runData ?? {}

  // Webhook body
  const body: Record<string, unknown> =
    runData['Webhook']?.[0]?.data?.main?.[0]?.[0]?.json?.body ?? {}

  const userId    = String(body['userId']    ?? '?')
  const sessionId = String(body['sessionId'] ?? '?')
  const messageIn = String(body['message']   ?? '')

  // Router output → skill path
  let skillActivated = 'unknown'
  const routerMain = runData['Router']?.[0]?.data?.main ?? []
  for (const branch of routerMain) {
    if (Array.isArray(branch) && branch[0]) {
      skillActivated = String(branch[0].json?.output ?? 'unknown')
      break
    }
  }

  // Final response — try all Respond nodes with fixed extraction
  let messageOut = ''
  const respondNodes = [
    'Respond to Webhook', 'Respond to Webhook1', 'Respond to Webhook2',
    'Respond to Webhook3', 'Respond to Webhook4', 'Respond to Webhook5',
  ]
  for (const node of respondNodes) {
    const item = runData[node]?.[0]?.data?.main?.[0]?.[0]?.json
    if (!item) continue
    const msg = extractMessageFromJson(item)
    if (msg) { messageOut = msg; break }
  }

  return {
    id: ex.id,
    status: ex.status,
    startedAt: ex.startedAt,
    durationMs: dur,
    userId,
    sessionId,
    messageIn,
    messageOut,
    skillActivated,
    errorOccurred: ex.status === 'error',
  }
}
