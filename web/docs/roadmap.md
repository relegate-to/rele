---
title: Rele Roadmap
date: April 9, 2026
author: Sam
---

# Rele Roadmap

## Hardening
**Priority: High**

The platform needs to be reliable before it gets more capable. Instances are slow to start and sometimes refuse to stop or start at all. When OpenClaw restarts the gateway, the system doesn't always recover cleanly. Instance resources are fixed right now — users should be able to configure how much CPU and memory their instance gets.

- Fix slow instance start times and unresponsive stop/start operations
- Improve gateway recovery after OpenClaw-initiated restarts
- Make instance resource limits (CPU, memory) configurable per user
- Comprehensive error handling across gate, instances, and chat
- Structured logging with trace IDs end-to-end
- Better recovery from network and machine failures
- Automated test pipeline for critical paths

---

## Session Management
**Priority: High**

Right now users can only talk to the main OpenClaw session. There's no way to manage past conversations, start fresh, or run multiple parallel sessions. Clearing chats is not currently possible.

- Clear individual chats or full history
- Multi-session support — run and switch between parallel conversations
- Session list with search and filtering
- Name and organise sessions
- Persist session state across reconnects

---

## Chat Improvements
**Priority: Medium**

Make conversations more useful day-to-day. The most important missing feature is direct OpenClaw command invocation from chat — triggering agent actions without leaving the conversation. After that, copy/export and then file attachments.

- Direct OpenClaw command invocation from the chat input
- One-click copy for messages and code blocks
- Export conversations to markdown or PDF
- File and image attachments
- Better code block rendering and syntax highlighting

---

## OpenClaw Interfaces & Configuration
**Priority: Medium**

OpenClaw currently lacks a proper management UI. Users need surfaces for configuring their instance, viewing what OpenClaw is doing, and tweaking its behaviour without dropping into raw config files.

- Visual configuration interface for OpenClaw settings
- Live view of what OpenClaw is currently doing (tools, tasks, state)
- Manage channels, skills, and permissions from the UI
- Guided onboarding for first-time OpenClaw setup
- Audit log of agent actions

---

## Agent Templates
**Priority: Medium**

Getting OpenClaw configured well requires a lot of upfront effort. Templates let users start from a known-good configuration for common use cases — a research agent, a coding agent, a support agent — rather than building from scratch.

- Curated library of starter agent templates
- One-click deploy from template to running instance
- Community-contributed templates
- Clone and customise existing configurations
- Version control for agent configs

---

## Skill Management
**Priority: Medium**

Skills are powerful but currently hard to manage. Users need better tooling to see what skills are installed, test them, update them, and organise them.

- Unified skills dashboard with install/uninstall/update
- Per-skill usage stats and error rates
- Test a skill directly from the UI
- Skill versioning and rollback
- Dependency resolution between skills

---

## Mobile App
**Priority: Medium**

A native mobile app would let users stay connected to their agents on the go — check in on running tasks, respond to agent questions, and kick off new work from anywhere.

- Native iOS and Android apps
- Push notifications for agent events and completions
- Chat interface optimised for mobile
- Quick-launch common commands
- Secure biometric auth

---

## MCP Management
**Priority: Low**

OpenClaw may occasionally need to make configuration changes to the instance it runs on. This is rare and low priority but worth building cleanly when the time comes.

- MCP server exposing gateway ops (restart, config, status)
- Safe, audited interface for agent-initiated config changes
- Rate limiting and sandboxing for agent actions

---

## UI Rendering
**Priority: Medium**

Longer-term vision: agents that can build and serve interactive UI directly in the console. Not a near-term priority but will be transformative when it arrives.

- Canvas-based rendering of agent-generated interfaces
- Real-time collaboration and presence visualisation
- Sandboxed execution for agent-authored UI code
- Smooth layout transitions and animation support
