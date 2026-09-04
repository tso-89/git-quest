# Architecture Overview

> **Status:** Living document — update when significant structural changes occur.
> **Last Updated:** {{DATE}}

## System Purpose

{{PROJECT_DESCRIPTION}}


## High-Level Architecture

> Add a system diagram here. A ```mermaid fenced block renders on GitHub and in most
> markdown viewers:
>
> ```mermaid
> flowchart LR
>   client[Client] --> api[API] --> db[(Database)]
> ```

## Component Breakdown

## Data Flow

1. Request hits the API router.
2. Middleware chain (auth → rate-limit → validate).
3. Controller delegates to service.
4. Service calls repositories for data.
5. Response returned; side effects queued if needed.

## Key Design Decisions

See [`ADR/`](ADR/) for full records.

| ADR | Decision | Status |
|-----|----------|--------|
| [ADR-001](ADR/ADR-001-ai-tooling.md) | AI tooling configuration | Accepted |

## External Dependencies


## Deployment


## Non-Functional Requirements


## Glossary

