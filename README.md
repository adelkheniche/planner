# Planner

A simple web-based planner to visualize the agenda and track all actions that students must complete in parallel during a seven-week course.

## Objective

The planner helps students stay organized by laying out tasks week by week. It displays multiple activities in parallel, making it easy to track overlapping assignments, group projects, and key milestones across the entire seven-week session.

## Technology

- **React 18** renders the interactive timeline interface directly in the browser.
- **Tailwind CSS** provides utility classes for quick styling and layout.
- **Yjs** provides CRDT shared state.
- **y-webrtc** enables P2P realtime (default mode).
- **y-websocket** can be enabled for production-grade signaling/relay.
- **Babel** transpiles JSX on the fly so that the app can be served as a simple static page.

All client-side dependencies are loaded from CDNs, allowing the planner to run without a build step.

## Realtime Modes

The app now supports two runtime modes:

- `webrtc` (default): uses y-webrtc + signaling servers.
- `websocket`: uses y-websocket against your own backend endpoint.

### Configure by URL

- WebRTC mode (default):
  - `?rt=webrtc`
  - optional custom signaling: `?rt=webrtc&signaling=wss://your-signal.example.com`
- WebSocket mode:
  - `?rt=websocket&ws=wss://your-yws.example.com`

You can also persist values in localStorage:

- `planner_rt_mode`: `webrtc` or `websocket`
- `planner_signaling_url`: comma-separated signaling URLs
- `planner_ws_endpoint`: websocket endpoint URL

## Minimal backend for production (y-websocket)

A tiny Node server is provided in `infra/y-websocket`.

```bash
cd infra/y-websocket
npm install
npm start
```

Environment variables:

- `PORT` (default `1234`)
- `HOST` (default `0.0.0.0`)

Health endpoint:

- `GET /healthz`

Typical deployment target: Render / Railway / Fly.io free tier, then point the static app to:

- `https://<user>.github.io/planner/?rt=websocket&ws=wss://<your-backend-domain>`

## Usage

1. Open `docs/index.html` in a modern browser.
2. Add categories and tasks to build the timeline.
3. Drag tasks across the weeks to adjust scheduling. Notes can be attached to tasks for additional context.

Because the app is static, it can be hosted on any static file server (such as GitHub Pages) by serving the `docs/` directory.
