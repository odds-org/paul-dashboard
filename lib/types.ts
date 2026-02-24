export interface Summary {
  total_requests:  number
  unique_users:    number
  avg_latency_ms:  number
  error_rate_pct:  number
  web_search_count: number
  new_sessions:    number
}

export interface SkillRow  { skill_activated: string; count: number }
export interface ToolRow   { tool: string; count: number }

export interface Latency {
  p50: number; p95: number; p99: number; max_ms: number
}

export interface RequestsOverTimeRow {
  hour:     string
  requests: number
  users:    number
  avg_ms:   number
  errors:   number
}

export interface RecentRequest {
  correlation_id:      string
  user_id:             string
  skill_activated:     string
  tools_used:          string[]
  tool_calls_count:    number
  web_search_used:     boolean
  request_duration_ms: number
  error_occurred:      boolean
  error_message:       string | null
  output_type:         string
  first_message:       boolean
  created_at:          string
}

export interface StatsData {
  summary:          Summary
  skills:           SkillRow[]
  tools:            ToolRow[]
  latency:          Latency
  requestsOverTime: RequestsOverTimeRow[]
  recentRequests:   RecentRequest[]
}

export interface AnalyticsEvent {
  correlationId:      string
  userId:             string
  sessionId:          string
  clientId:           string
  firstMessage:       boolean
  hasMemoryFile:      boolean
  isFirstMsgOfDay:    boolean
  skillActivated:     string
  toolsUsed:          string[]
  toolCallsCount:     number
  webSearchUsed:      boolean
  requestDurationMs:  number
  errorOccurred:      boolean
  errorMessage?:      string
  outputType:         string
  outputLength:       number
  createdAt:          string
  messageIn:          string
  messageOut:         string
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface ConversationSession {
  session_id:       string
  user_id:          string
  started_at:       string
  last_message_at:  string
  message_count:    number
  last_skill:       string
  last_message_in:  string
  last_message_out: string
  last_duration_ms: number
}

export interface ConversationMessage {
  id:               number
  correlation_id:   string
  user_id:          string
  message_in:       string
  message_out:      string
  response_json:    unknown
  skill_used:       string
  tool_calls_count: number
  duration_ms:      number
  created_at:       string
}

export interface SessionsResponse {
  type:     'sessions'
  sessions: ConversationSession[]
}

export interface ThreadResponse {
  type:      'thread'
  sessionId: string
  messages:  ConversationMessage[]
}
