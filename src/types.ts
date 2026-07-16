/**
 * Native WebSocket stream event types for a mock LLM stream.
 *
 * There are two parallel streams of text:
 *   - reasoning: many `thinking` chunks, then one final `thought`
 *   - answer:    many `token` chunks, then one final `summary`
 *
 * `tool` reports a tool call, and `error` reports a failure.
 *
 * Everything here is plain JSON, so it survives JSON.stringify / JSON.parse
 * across the socket without any custom serialization.
 */

/** The string tags that tell the events apart. */
export type WSEventType =
  | 'token'
  | 'thinking'
  | 'thought'
  | 'summary'
  | 'tool'
  | 'error';

/** Fields that every event carries. */
export interface WSEventBase {
  /** Groups all events that belong to one response. */
  streamId: string;
  /** When the server sent this event (epoch milliseconds). */
  timestamp: number;
}

/** A chunk of streaming text. Used by token and thinking. */
export interface StreamChunk extends WSEventBase {
  /** The piece of text in this chunk. */
  text: string;
  /**
   * Order of this chunk in its stream, starting at 0.
   * Handy for testing a mock. Drop it if you don't need ordering checks.
   */
  index: number;
}

/** A finished block of text. Used by thought and summary. */
export interface StreamComplete extends WSEventBase {
  /** The full text, all chunks joined together. */
  text: string;
}

/** A reference document the answer cites with inline [n] markers. `id` is the
 *  number that appears as [n] in the summary text. */
export interface WSSource {
  id: number;
  title: string;
  markdown: string;
}

/** A small chunk of the final answer. */
export interface TokenEvent extends StreamChunk {
  type: 'token';
}

/** A small chunk of the model's reasoning. */
export interface ThinkingEvent extends StreamChunk {
  type: 'thinking';
}

/** The complete reasoning, sent once thinking is done. */
export interface ThoughtEvent extends StreamComplete {
  type: 'thought';
}

/** The complete final answer, sent once tokens are done. Carries the answer's
 *  cited reference documents, if any. */
export interface SummaryEvent extends StreamComplete {
  type: 'summary';
  /** References backing this answer, resolved by their inline [n] markers. */
  sources?: WSSource[];
}

/** Where a tool call is in its life. */
export type ToolStatus = 'started' | 'completed' | 'failed';

/** A tool call and its progress. */
export interface ToolEvent extends WSEventBase {
  type: 'tool';
  /** Name of the tool being called. */
  name: string;
  /** Unique id for this one tool call, so you can match start and finish. */
  toolCallId: string;
  /** Current stage of the call. */
  status: ToolStatus;
  /** Arguments passed in. Present when the call starts. */
  input?: Record<string, unknown>;
  /** Whatever the tool returned. Present when status is 'completed'. */
  output?: unknown;
  /** Why it failed. Present when status is 'failed'. */
  error?: string;
}

/** Something went wrong. */
export interface ErrorEvent extends WSEventBase {
  type: 'error';
  /** Plain language description of the problem. */
  message: string;
  /** Optional short code you can switch on in code. */
  code?: string;
  /** True if the stream can keep going, false if it is dead. */
  recoverable: boolean;
}

/** Any event that can come across the socket. */
export type WSEvent =
  | TokenEvent
  | ThinkingEvent
  | ThoughtEvent
  | SummaryEvent
  | ToolEvent
  | ErrorEvent;

/** Maps each type tag to its event shape. Useful for a typed on(type, handler) API. */
export interface WSEventMap {
  token: TokenEvent;
  thinking: ThinkingEvent;
  thought: ThoughtEvent;
  summary: SummaryEvent;
  tool: ToolEvent;
  error: ErrorEvent;
}

/**
 * One type guard that works for every event type.
 *
 *   if (isEvent(evt, 'summary')) {
 *     // evt is narrowed to SummaryEvent here
 *     console.log(evt.text);
 *   }
 */
export function isEvent<K extends WSEventType>(
  event: WSEvent,
  type: K,
): event is WSEventMap[K] {
  return event.type === type;
}
