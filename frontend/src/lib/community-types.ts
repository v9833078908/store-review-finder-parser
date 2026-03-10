export type CommunitySentiment = "positive" | "negative" | "neutral" | "mixed"

export interface CommunitySummary {
  total_messages?: number
  total_threads?: number
  signal_count?: number
  noise_count?: number
  signal_pct?: number
  topic_distribution?: Record<string, number>
  sentiment_distribution?: Partial<Record<CommunitySentiment, number>>
  avg_gate_confidence?: number
  avg_classify_confidence?: number
}

export interface CommunityMessage {
  msg_id: string
  timestamp: string
  user_id?: string
  username?: string
  display_name?: string
  chat_id?: string
  chat_type?: string
  text: string
  gate_label?: "signal" | "noise" | string
  gate_confidence?: number
  topic: string
  topic_secondary?: string
  sentiment: CommunitySentiment | string
  classify_confidence?: number
  summary?: string
}

export interface CommunityNoiseMessage {
  msg_id: string
  text: string
  gate_confidence?: number
}

export interface CommunityDataFile {
  summary?: CommunitySummary
  classified: CommunityMessage[]
  noise?: CommunityNoiseMessage[]
}
