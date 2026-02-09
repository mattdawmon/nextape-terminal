# NextApe Terminal

Professional multi-chain crypto trading terminal with AI-powered trading agents.

![NextApe](https://img.shields.io/badge/NextApe-Terminal-00ff88?style=for-the-badge)
![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)
![Chains](https://img.shields.io/badge/Chains-SOL%20%7C%20ETH%20%7C%20BASE%20%7C%20BNB%20%7C%20TRX-blue?style=for-the-badge)

## Overview

NextApe is a comprehensive crypto trading terminal designed for professional traders. It offers real-time token discovery, on-chain trading, smart money tracking, copy trading, and advanced analytics across **Solana, Ethereum, Base, BNB Chain, and Tron**.

### Key Features

- **AI Trading Agents** - Autonomous agents (Conservative, Balanced, Aggressive, Degen) powered by GPT with adaptive real-time learning, 7 data streams, and 10-second execution cycles
- **Instant On-Chain Trading** - In-app wallet generation, real on-chain swaps via Jupiter (SOL), Uniswap (ETH/Base), PancakeSwap (BNB)
- **Smart Money Intelligence** - Track top trader wallets, whale accumulation, net flow, and signal scoring
- **Meme Token Tracker** - Live DexScreener data, launchpad discovery, bonding curve visualization, dev wallet analysis
- **Copy Trading & Sniper Mode** - Follow top wallets and auto-execute trades
- **Trading Automation** - Price alerts, limit orders, stop orders, DCA
- **Social Sentiment** - LunarCrush integration, galaxy score, social volume analysis
- **Token Safety Scanner** - GoPlus Security audits, multi-factor risk assessment, AI-powered recommendations
- **Professional Charts** - TradingView lightweight-charts with OHLCV data from GeckoTerminal
- **News Scanner** - Real-time crypto news with sentiment analysis and impact scoring
- **Fear & Greed Index** - Market sentiment tracking with trend analysis
- **Liquidity Tracker** - Monitor DEX liquidity pools for significant changes

## Tech Stack

### Frontend
- React + TypeScript + Vite
- shadcn/ui + Tailwind CSS (custom dark terminal theme)
- TradingView lightweight-charts, recharts
- TanStack React Query v5
- WalletConnect (@reown/appkit) + wagmi + viem
- Multi-language support (EN/CN/ES)

### Backend
- Express.js + TypeScript
- PostgreSQL + Drizzle ORM
- WebSocket for real-time data
- OpenAI GPT for AI agents

### AI Agent Runner v4.0 SUPERSONIC
- 10-second execution cycles (3x faster than v3)
- Parallel agent execution via Promise.allSettled
- Shared signal cache per cycle
- Batched DB writes
- In-memory signal performance cache
- 7 data streams: Smart Money, Social Sentiment, News, Fear & Greed, Liquidity, Technical Analysis, Token Safety

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/nextape-terminal.git
cd nextape-terminal

# Install dependencies
npm i

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session secret |
| `WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key for AI agents |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI API base URL |

## Project Structure

```
nextape-terminal/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities and helpers
│   │   └── contexts/        # React contexts
│   └── integrations/        # Client-side integrations
├── server/                  # Express backend
│   ├── ai/                  # AI agent system
│   │   ├── agent-runner.ts  # SUPERSONIC v4.0 runner
│   │   ├── signal-builder.ts
│   │   └── technical-indicators.ts
│   ├── integrations/        # Server-side integrations
│   │   ├── auth/            # WalletConnect + SIWE auth
│   │   ├── audio/           # Voice/audio features
│   │   ├── chat/            # Chat features
│   │   └── image/           # Image generation
│   ├── routes.ts            # API routes
│   ├── storage.ts           # Database operations
│   ├── live-memes.ts        # DexScreener integration
│   ├── onchain-swap.ts      # On-chain trade execution
│   └── goplus.ts            # Token security scanner
├── shared/
│   └── schema.ts            # Database schema + types
└── attached_assets/         # Static assets
```

## Supported Chains

| Chain | DEX | Status |
|-------|-----|--------|
| Solana | Jupiter | Active |
| Ethereum | Uniswap V2 | Active |
| Base | Uniswap V2 | Active |
| BNB Chain | PancakeSwap V2 | Active |
| Tron | SunSwap | Active |

## AI Agent Strategies

| Strategy | Risk | Description |
|----------|------|-------------|
| Conservative | Low | Blue-chip tokens, high liquidity, tight stop-losses |
| Balanced | Medium | Mix of established and trending tokens |
| Aggressive | High | High-volatility plays, momentum trading |
| Degen | Maximum | Meme tokens, new launches, maximum risk/reward |

## Subscription Tiers

| Feature | Free | Pro ($29/mo) | Elite ($99/mo) | Whale ($199/mo) |
|---------|------|-------------|----------------|-----------------|
| AI Agents | 1 | 3 | 5 | 10 |
| Daily Trades | 10 | 50 | Unlimited | Unlimited |
| Smart Money | Basic | Full | Full + Follow | Full + Follow |
| Copy Trading | - | 5 configs | 15 configs | Unlimited |
| Sniper Mode | - | 5 rules | 15 rules | Unlimited |

## API Endpoints

### Authentication
- `GET /api/auth/nonce` - Get SIWE nonce
- `POST /api/auth/verify` - Verify wallet signature
- `POST /api/auth/wallet` - Quick wallet connect
- `POST /api/auth/logout` - Logout

### Trading
- `POST /api/swap` - Execute on-chain swap
- `GET /api/live-memes` - Get live token data
- `GET /api/ohlcv/:pairAddress` - Get candlestick data

### AI Agents
- `GET /api/ai-agents` - List user's agents
- `POST /api/ai-agents` - Create new agent
- `POST /api/ai-agents/:id/start` - Start agent
- `POST /api/ai-agents/:id/stop` - Stop agent

### Market Data
- `GET /api/smart-money/wallets` - Top trader wallets
- `GET /api/smart-money/signals` - Trading signals
- `GET /api/social-sentiment` - Social metrics
- `GET /api/news` - News with sentiment
- `GET /api/fear-greed` - Fear & Greed Index

## Contributing

This is currently a private project. Contact the team for collaboration opportunities.

## License

Proprietary. All rights reserved.

---

**NextApe Terminal** - Trade Smarter. Trade Faster.
