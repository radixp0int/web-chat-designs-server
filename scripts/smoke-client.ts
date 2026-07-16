// Standalone smoke-test client:
//   npm run smoke -- "check the market"
// Connects, sends the prompt, pretty-prints every event, exits on the
// terminal event (summary, or a non-recoverable error).

import { WebSocket } from 'ws';
import { isEvent, type WSEvent } from '../src/types.ts';

const prompt = process.argv.slice(2).join(' ') || 'tell me about compound interest';
const url = process.env.WS_URL ?? 'ws://localhost:8787';

const socket = new WebSocket(url);
let thinking = '';
let answer = '';

socket.on('open', () => {
  console.log(`connected to ${url}, sending: ${JSON.stringify(prompt)}\n`);
  socket.send(JSON.stringify({ type: 'chat', prompt }));
});

socket.on('message', (data) => {
  const event = JSON.parse(data.toString()) as WSEvent;

  if (isEvent(event, 'thinking')) {
    thinking += event.text;
    process.stdout.write(`\r[thinking] ${thinking.length} chars…`);
  } else if (isEvent(event, 'thought')) {
    console.log(`\n[thought]  matches accumulated: ${event.text === thinking}`);
  } else if (isEvent(event, 'token')) {
    answer += event.text;
    process.stdout.write(`\r[token]    ${answer.length} chars…`);
  } else if (isEvent(event, 'summary')) {
    console.log(`\n[summary]  matches accumulated: ${event.text === answer}`);
    console.log(`\n--- final answer ---\n${event.text}`);
    socket.close();
  } else if (isEvent(event, 'tool')) {
    const detail =
      event.status === 'started'
        ? JSON.stringify(event.input)
        : event.status === 'completed'
          ? JSON.stringify(event.output)
          : event.error;
    console.log(`\n[tool]     ${event.name} ${event.status}: ${detail}`);
  } else if (isEvent(event, 'error')) {
    console.log(`\n[error]    (${event.code ?? 'no code'}, recoverable=${event.recoverable}) ${event.message}`);
    if (!event.recoverable) socket.close();
  }
});

socket.on('close', () => {
  console.log('\nsocket closed');
  process.exit(0);
});

socket.on('error', (err) => {
  console.error('socket error:', err.message);
  process.exit(1);
});
