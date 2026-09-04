# Security Guide

> Security requirements for this project. Applies to all code and infrastructure.
> This is the extended reference. The condensed agent-facing rules are in
> [`docs/rules/security.md`](../rules/security.md).

## Threat Model

> Replace with your actual threat model. Who are adversaries? What do they want?

| Threat Actor    | Motivation          | Risk Level |
|-----------------|---------------------|------------|
| External hacker | Data exfiltration   | High       |
| Insider threat  | Privilege abuse     | Medium     |
| Script kiddie   | Service disruption  | Low        |

## Secrets Management

- All secrets via environment variables or a secrets manager (e.g. AWS Secrets Manager, Vault).
- Local development: use `.env` files (gitignored); never commit them.
- Rotate secrets after any suspected compromise — no exceptions.
- Audit secret access quarterly.

## Authentication

- Session tokens: JWT with short expiry (15 min access, 7-day refresh with rotation).
- Password hashing: `argon2id` (preferred) or `bcrypt` with cost factor ≥ 12.
- MFA: required for admin accounts; optional for standard users.
- Account lockout: 5 failed attempts → 15-minute lockout with exponential backoff.

## Authorisation

- Role-based access control (RBAC): define roles in `src/auth/roles.ts`.
- Check authorisation **in the service layer**, not just the controller.
- Default deny: if a role is not explicitly granted permission, it is denied.
- Never trust client-supplied IDs for ownership checks — always verify against the authenticated user.

## Input Validation

```typescript
// ✅ Good — schema validation at the boundary
const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
})

const input = schema.parse(req.body) // throws on invalid input

// ❌ Bad — raw unvalidated input
const { email, age } = req.body
```

## SQL / Query Safety

```typescript
// ✅ Good — parameterised query
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId])

// ❌ Bad — SQL injection risk
const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`)
```

## Logging & Monitoring

- Log all authentication attempts (success and failure) with IP and timestamp.
- **Never** log passwords, tokens, card numbers, or PII.
- Alert on: 5xx error rate > 1%, auth failure rate spikes, unusual data access patterns.
- Retain security logs for ≥ 90 days.

## Dependency Security

```bash
# Run before every release
pnpm audit --audit-level=high

# Check for outdated packages monthly
pnpm outdated
```

## Incident Response

1. **Detect** — monitoring alert or user report.
2. **Contain** — revoke affected tokens, block attack vector.
3. **Assess** — determine scope of impact.
4. **Remediate** — fix the vulnerability, rotate secrets.
5. **Communicate** — notify affected users if data was compromised (check legal requirements).
6. **Review** — post-mortem: what happened, why, what prevents recurrence.

## Security Headers

```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
