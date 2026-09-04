---
name: agent-name
description: >
  Trigger description of WHEN to delegate to this agent (e.g., "Use this agent when asked to manage database migrations").
  Write this as "Use this agent when..." so the main agent knows when to route tasks here.
model: opus                  # Optional: prefer aliases (opus | sonnet | haiku | inherit)
effort: high                 # Optional: low | medium | high | xhigh | max
tools: Read, Grep, Glob, Bash  # Optional: comma-separated list restricting this subagent
---

# Agent Name Agent

Detailed, focused system prompt for the specialized subagent.

## Purpose

Describe the specific, narrow scope of this agent. It should have a non-overlapping responsibility with other agents.

## Core Responsibilities

1. **Task A** — Description of what this agent must handle.
2. **Task B** — Description of what this agent must handle.

## Guidelines & Constraints

- Constraint 1.
- Constraint 2.

## Expected Output / Interface

Describe how this agent should present its results, or specify a structured template if applicable.

---

> **Tool names must match the host platform's tool set.** For Claude Code these are
> `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`, `WebFetch`, `WebSearch` — given as a
> comma-separated string, not a YAML list. Omit `tools` entirely to inherit every tool.
