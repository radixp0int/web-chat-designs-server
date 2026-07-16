# chat-ws-server

Mock WebSocket server that streams fake LLM events to the `chat-interfaces` UI.
No build step — runs `.ts` directly via Node's type stripping (Node 22.6+).

## Run the demo

```sh
# terminal 1 — this directory
npm install
npm run dev            # ws://localhost:8787

# terminal 2 — ../chat-interfaces
npm run dev            # http://localhost:5173 (VITE_WS_URL in .env.development points here)
```

## Protocol

Client sends `{"type":"chat","prompt":"..."}`; the server streams `WSEvent`s
(see [src/types.ts](src/types.ts)): `thinking` chunks → `thought`, `tool`
started/completed/failed, `token` chunks → `summary`, and `error`. Closing the
socket cancels the in-flight stream. The UI keeps a verbatim copy of the
protocol in `chat-interfaces/src/lib/wsProtocol.ts` — keep them in sync.

## Demo keywords

The prompt routes the scenario (see [src/scenarios.ts](src/scenarios.ts)):

| Prompt contains          | Scenario                                          |
| ------------------------ | ------------------------------------------------- |
| `error`                  | Answer dies mid-stream with a fatal error event   |
| `fail`                   | Tool call fails, model recovers via a second tool |
| `tool`, `market`, `rate` | Two sequential successful tool calls              |
| anything else            | Cycles through the default scenarios              |

## Smoke test

```sh
npm run smoke -- "how does the market look"
```

Prints every event and verifies streamed chunks reassemble into the final
`thought`/`summary` texts.
