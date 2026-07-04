# Demo Video Script — 2 Minutes

Narration + on-screen action for the "Lights, Fans, Discord" submission video. Written against the
features actually implemented and verified working in `/backend` and `/frontend`.

**Total narration: ~280 words** (fits 2:00 at a normal speaking pace, with room for on-screen
actions like clicking the demo-clock trigger or typing in Discord).

---

## Script

| Time | On screen | Say |
| --- | --- | --- |
| **0:00–0:10** | Title card / dashboard loading | "Hi, we're [team name] — this is 'Lights, Fans, Discord,' a real-time office monitor with a live web dashboard and an AI-powered Discord bot, both reading from one shared backend." |
| **0:10–0:35** | Office floor layout — lights glowing, fans spinning, a device flips on its own | "Here's the dashboard — three rooms, fifteen devices. Lights glow and fans spin when they're on, and everything updates on its own, no refresh button. A background simulator flips a few devices every few seconds, weighted toward on during office hours, so what you're seeing is genuinely live, not staged." |
| **0:35–0:55** | Pan to power meter + per-room breakdown + today's kWh | "Up top is the live power meter — total wattage right now, a per-room breakdown, and today's estimated kilowatt-hours, integrated from real samples since midnight. All of it comes straight from the backend; the dashboard never computes its own numbers." |
| **0:55–1:20** | Trigger demo-clock override → after-hours alert appears live in the Alerts panel | "The alerts panel covers two rules — after-hours, if anything's left on outside nine-to-five, and long-on, if a room's been running over two hours straight. Let me force the demo clock to ten PM... and there it is, an after-hours alert appears immediately, live." |
| **1:20–1:45** | Switch to Discord, type `!ask what's the office power usage right now?`, bot replies | "Now the Discord bot — I'll ask it directly, 'what's the office power usage right now?' — and it answers using that exact same live data. An LLM phrases the reply, but it can only speak from the real snapshot we send it, with a safe template fallback if that call ever fails." |
| **1:45–2:00** | Quick architecture diagram, then dashboard + Discord side by side | "Under the hood it's one flow: simulator, to SQLite, to backend, pushed out over WebSocket to the dashboard and REST to the bot — one source of truth, so they can never disagree. Thanks for watching!" |

---

## Pre-Recording Checklist

- [ ] Simulator is running (not paused) so a natural device flip happens during 0:10–0:35.
- [ ] Demo-clock override request is ready to fire instantly (saved `curl`/Postman call, or a
      dashboard button if one exists) — don't fumble for it on camera.
- [ ] `OPENROUTER_API_KEY` is set and the bot is online in the test Discord server, so `!ask`
      returns the real LLM-phrased answer instead of the flatter template fallback.
- [ ] Do one full dry run before the final take to confirm timing lands close to 2:00.
