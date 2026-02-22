import http from 'node:http'
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils.js'

const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number(process.env.PORT || 1234)

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('planner y-websocket signaling is running')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { gc: true })
})

server.listen(PORT, HOST, () => {
  console.log(`[y-websocket] listening on http://${HOST}:${PORT}`)
})
