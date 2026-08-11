// Mock LLM WebSocket server.
//
// Protocol: the client sends {"type":"chat","prompt":"..."} and the server
// streams WSEvents (see types.ts) until the response finishes. Closing the
// socket cancels the in-flight stream; sending a new chat message replaces it.

import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { pickScenario } from './scenarios.ts';
import { runScenario } from './stream.ts';
import type { WSEvent } from './types.ts';

const PORT = Number(process.env.PORT ?? 8787);

const wss = new WebSocketServer({ port: PORT });
let connSeq = 0;

wss.on('connection', (socket: WebSocket) => {
  const connId = `conn-${++connSeq}`;
  let active: AbortController | null = null;
  console.log(`[${connId}] connected`);

  const send = (event: WSEvent) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  };

  socket.on('message', (data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      console.log(`[${connId}] ignoring non-JSON message`);
      return;
    }
    const msg = parsed as { type?: string; prompt?: string };
    if (msg.type !== 'chat' || typeof msg.prompt !== 'string') {
      console.log(`[${connId}] ignoring unknown message`, parsed);
      return;
    }

    // One active stream per connection; a new chat cancels the old one.
    active?.abort();
    const controller = new AbortController();
    active = controller;

    const streamId = randomUUID();
    console.log(`[${connId}] stream ${streamId} started — prompt: ${JSON.stringify(msg.prompt)}`);

    runScenario(pickScenario(msg.prompt), streamId, send, controller.signal)
      .then(() => {
        const outcome = controller.signal.aborted ? 'cancelled' : 'finished';
        console.log(`[${connId}] stream ${streamId} ${outcome}`);
      })
      .catch((err) => {
        console.error(`[${connId}] stream ${streamId} crashed:`, err);
        send({
          type: 'error',
          streamId,
          timestamp: Date.now(),
          message: 'Internal mock-server error',
          code: 'INTERNAL',
          recoverable: false,
        });
      });
  });

  socket.on('close', () => {
    active?.abort();
    console.log(`[${connId}] disconnected`);
  });

  socket.on('error', (err) => {
    console.error(`[${connId}] socket error:`, err.message);
  });
});

console.log(`Mock LLM WebSocket server listening on ws://localhost:${PORT}`);
console.log(
  'Prompt keywords: "degraded", "error", "fail", "50"/"stress", "cite"/"source", "tool"/"market" — see README',
);
