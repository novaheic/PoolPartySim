# Pool Party

Interactive Uniswap V2-style AMM sandbox for teaching DeFi basics. Everything is simulated — no blockchain, no wallets. Multiple people join one shared global sandbox via PartyKit.

## Quick start

```bash
npm install

# Terminal 1 — must print "Ready on …:1999" (not a random port)
npm run dev:party

# Terminal 2 — Vite UI
npm run dev
```

Open the Vite URL (e.g. http://localhost:5173). The browser connects **directly** to PartyKit at `127.0.0.1:1999`.

If join fails: stop every `partykit` / `vite` process, then start `dev:party` first and confirm port **1999**, then `dev`.

```bash
npm test        # AMM + period unit tests
npm run build   # production client build
npm run deploy  # deploy PartyKit (requires partykit login)
```

Optional: set `VITE_PARTYKIT_HOST` if the PartyKit host is not `127.0.0.1:1999` in local dev (or not the page host in production).

## What you get

- Tokens: **WOOD**, **STONE**, **GOLD**
- Three constant-product pools with a **0.3% fee**, seeded slightly mispriced so triangular arbitrage exists
- Shared multiplayer: everyone who opens the site joins the same `global` room
- Join with any display name (soft cap 50 players)
- Swap + LP UI, live `x·y=k` curve, activity feed, IL tracker, arb hints, guided challenges
- Instructor mode: oracle price sliders, whale trade, airdrop
- Auto-reseed **Saturday 00:00 Europe/Amsterdam** (no manual reset)
- PartyKit free tier may also clear idle storage ~daily — a cold room simply reseeds on next join

## AMM math (short)

Constant product:

\[
x \cdot y = k
\]

A swap of \(\Delta x\) (after fee) receives:

\[
\Delta y = \frac{y \cdot \Delta x_{\text{in}}}{x + \Delta x_{\text{in}}}
\]

with \(\Delta x_{\text{in}} = \Delta x \cdot (1 - 0.003)\). The fee stays in the pool, so \(k\) grows and LPs earn when others trade.

**Spot price** is the reserve ratio \(y/x\). **Execution price** is \(\Delta y / \Delta x\) for your trade size — the gap is **price impact**.

**LP tokens** are your share of the pool. First deposit sets the price (\(LP = \sqrt{a\cdot b}\)); later deposits must match the current ratio.

**Impermanent loss** is the gap between LP value and simply holding the deposited tokens when relative prices move (classic ~5.7% loss when price 2× with no fees).

Three pools let the class see **arbitrage**: if WOOD/GOLD disagrees with WOOD/STONE × STONE/GOLD, buy the cheap path and sell the expensive one.

## Project layout

- `src/amm.ts` — pure AMM helpers (tested)
- `src/seed.ts` / `src/lib/period.ts` — initial pools + Saturday period ids
- `party/sandbox.ts` — authoritative PartyKit room
- `src/store.ts` — Zustand client mirror + PartySocket
- `src/components/*` — UI

## Workshop tips

1. Join on phones/laptops with different names.
2. Have one person make a tiny swap, another a whale-sized swap — compare impact on the curve.
3. Become LPs, then have someone else trade; remove liquidity and discuss fees vs IL.
4. Follow the Arbitrage badge and try the suggested route (manually — no auto-router).
5. Use Instructor oracle sliders to move “market” prices and revisit IL.
