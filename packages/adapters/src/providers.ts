export interface TelephonyEvent {
  provider: 'twilio' | 'telnyx' | 'local-simulator';
  providerCallId: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  receivedAt: string;
}

export interface SpeechRecognitionProvider {
  transcribeStream(input: AsyncIterable<Uint8Array>, options: { language: string; diarization: boolean; signal?: AbortSignal }): AsyncIterable<{ text: string; speaker: string; confidence: number; final: boolean }>;
}

export interface SpeechSynthesisProvider {
  speak(text: string, options: { voice: string; format: 'pcm_16000' | 'mulaw_8000'; signal?: AbortSignal }): AsyncIterable<Uint8Array>;
}

export interface CalendarProvider {
  listAvailability(input: { calendarId: string; startsAfter: string; durationMinutes: number; timezone: string }): Promise<{ startsAt: string; endsAt: string }[]>;
  createEvent(input: { calendarId: string; title: string; startsAt: string; endsAt: string; idempotencyKey: string }): Promise<{ eventId: string }>;
  cancelEvent(eventId: string): Promise<void>;
}

export interface CrmProvider {
  upsertContact(input: { email?: string; phone?: string; fields: Record<string, unknown>; idempotencyKey: string }): Promise<{ contactId: string }>;
  upsertDeal(input: { contactId: string; fields: Record<string, unknown>; idempotencyKey: string }): Promise<{ dealId: string }>;
}

export interface ModelProvider {
  generate<T>(input: { model: string; systemPrompt: string; promptVersion: string; responseSchema: object; input: unknown; traceId: string }): Promise<{ value: T; inputTokens: number; outputTokens: number; costUsd: number }>;
}
