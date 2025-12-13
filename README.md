# <a alt="Sia logo" href="https://getpullrequest.com" target="_blank" rel="noreferrer"><img src="apps/landing-page/public/favicon.svg" width="40"></a> Sia

<div align="center" style="margin-bottom: 2rem;">
  <img src="apps/landing-page/public/banner.png" alt="Sia - Wake Up To Ready Pull Requests" style="border-radius: 12px; aspect-ratio: 16/9; width: 100%; max-width: 1200px; object-fit: cover;" />
</div>
<br/>

> ⚠️ **Pre-alpha** - Still in active development, not ready for production yet.

</div>

Sia is an AI coding assistant that handles small coding tasks while you sleep. Give it a task, and wake up to a pull request ready for review.

## What does it do?

Sia works in Slack or Discord. Just mention `@sia` with what you need, and it'll queue the task, write the code, run tests, and open a PR. You can review and merge from your phone.

It uses your favourite vibe coding platform under the hood to actually write the code. Think of it as having a coding buddy that never sleeps.

## Features

**Chat integration** - Works in Slack and Discord. No need to leave your chat.

**Automatic PRs** - Code gets written, tested, and opened as a PR automatically.

**Runs 24/7** - Queue up tasks before you log off, wake up to PRs.

**Mobile friendly** - Review and merge PRs from your phone.

**Smart queue** - Prioritize, pause, or cancel tasks right from chat.

**Learns over time** - Gets better at understanding your preferences the more you use it.

## How it works

1. Send a task to Sia via Slack, Discord (currently in progress), or the web UI
2. Sia queues it up
3. AI agents work on it (writing code, running tests, fixing issues)
4. You get a PR ready for review
5. Review and merge when you're ready

## Architecture

It's a distributed setup:

- Web UI and chat integrations (Slack/Discord)
- Backend server that manages jobs and coordinates agents
- AI agents that run on cloud dev machines
- gRPC for communication between backend and agents

Want the nitty-gritty details? Check out [`.kiro/specs`](./.kiro/specs/) for architecture docs.

## Quick Start

You'll need:

- Node.js (v18+)
- npm
- PostgreSQL
- A GitHub account

```sh
# Clone it
git clone https://github.com/your-org/sia.git
cd sia

# Install dependencies
npm install

# Set up your .env file
cp .env.sample .env
# Edit .env with your config

# Run the dev servers (use two terminals)
npx nx serve @sia/web    # Terminal 1 - Web UI at http://localhost:3000
npx nx serve @sia/api    # Terminal 2 - API at http://localhost:3001
```

**Note:** If auth is set up, localhost might not work. Use ngrok for local dev in that case.

## Docs

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute
- **[CHANGELOG.md](./CHANGELOG.md)** - What's changed
- **[AGENTS.md](./AGENTS.md)** - For AI agents working with this codebase
- **[`.kiro/specs/`](./.kiro/specs/)** - Architecture and design docs

## Links

- Website: [getpullrequest.com](https://getpullrequest.com)

## Status

This is pre-alpha, so things are still changing. Feel free to contribute or give feedback!
