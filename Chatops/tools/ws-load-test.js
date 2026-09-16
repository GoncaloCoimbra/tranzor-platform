const WebSocket = require('ws');
const crypto = require('crypto');

const concurrency = Number(process.env.WS_CONCURRENCY || 50);
const durationMs = Number(process.env.WS_DURATION_SECONDS || 30) * 1000;
const intervalMs = Number(process.env.WS_MESSAGE_INTERVAL_SECONDS || 3) * 1000;
const url = process.env.WS_LOAD_URL || 'ws://localhost:9001';

function createToken(subject) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.WS_JWT_SECRET || 'change-me').update(`${header}.${payload}`).digest('base64url');
  return `Bearer ${header}.${payload}.${signature}`;
}

const latencies = [];
let accepted = 0;
let rejected = 0;
let sent = 0;
let responses = 0;
let closed = 0;
let finished = false;

function percentile(value) {
  const sorted = [...latencies].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] || 0;
}

function connect(index) {
  const socket = new WebSocket(url, { headers: { Authorization: createToken(`load-${index}`) } });
  let connected = false;
  let timer;

  socket.on('open', () => {
    connected = true;
    accepted += 1;
    const sendPing = () => {
      if (socket.readyState !== WebSocket.OPEN || finished) return;
      socket.__pingStarted = Date.now();
      socket.send(JSON.stringify({ type: 'ping', ts: socket.__pingStarted }));
      sent += 1;
    };
    sendPing();
    timer = setInterval(sendPing, intervalMs);
  });

  socket.on('message', (message) => {
    let event;
    try { event = JSON.parse(message.toString()); } catch { return; }
    if (event.type === 'pong' && socket.__pingStarted) {
      latencies.push(Date.now() - socket.__pingStarted);
      responses += 1;
    }
  });

  socket.on('close', (code) => {
    if (timer) clearInterval(timer);
    closed += 1;
    if (!connected && code === 4001) rejected += 1;
  });

  socket.on('error', () => {
    if (!connected) rejected += 1;
  });

  socket.__finish = () => {
    if (timer) clearInterval(timer);
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1000, 'load complete');
    } else if (socket.readyState === WebSocket.CONNECTING) {
      socket.terminate();
    }
  };
  return socket;
}

async function main() {
  const sockets = Array.from({ length: concurrency }, (_, index) => connect(index));
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  finished = true;
  sockets.forEach((socket) => socket.__finish());
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const errorRate = (rejected / concurrency) * 100;
  console.log(`WebSocket: ${url}`);
  console.log(`Duração: ${durationMs / 1000}s | Conexões pedidas: ${concurrency} | Intervalo: ${intervalMs / 1000}s`);
  console.log(`Conexões aceites: ${accepted}`);
  console.log(`Conexões rejeitadas: ${rejected}`);
  console.log(`Conexões fechadas: ${closed}`);
  console.log(`Mensagens enviadas/respondidas: ${sent}/${responses}`);
  console.log(`Mensagens/segundo: ${sent / (durationMs / 1000)}`);
  console.log(`Latência p50/p95/p99: ${percentile(0.5)}/${percentile(0.95)}/${percentile(0.99)} ms`);
  console.log(`Taxa de rejeição: ${errorRate}%`);
  process.exitCode = rejected > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});