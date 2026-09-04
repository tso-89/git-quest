# Git Workflow Guide

> This guide defines the branching strategy, commit conventions, and PR process for this project.
> AI agents should follow these conventions when creating branches and commits.

---

## Branching Strategy

We use **trunk-based development** with short-lived feature branches.

```
main                    ← always deployable
├── feat/add-login      ← feature branches (merge in < 2 days)
├── fix/null-crash      ← bug fix branches
├── docs/update-readme  ← documentation-only changes
└── chore/bump-deps     ← maintenance, no behaviour change
```

### Branch Naming

```
<type>/<short-slug>

Types: feat | fix | docs | refactor | test | chore | security
Slug:  kebab-case, max 5 words

Examples:
  feat/user-authentication
  fix/race-condition-in-queue
  docs/add-deployment-guide
  chore/upgrade-typescript-5
```

### Rules

- Branch from `main` — never from another feature branch.
- Keep branches short-lived (< 2 days if possible). Long-running branches accumulate merge conflicts.
- Delete branches after merge.

---

## Commit Conventions

We follow **Conventional Commits** (`<type>(<scope>): <description>`).

```
<type>(<scope>): <short description>

[optional body]

[optional footer: BREAKING CHANGE: ..., Closes #123]
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature or user-visible behaviour |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that is not a fix or feature |
| `test` | Adding or updating tests |
| `chore` | Build system, dependencies, config |
| `security` | Security fix or hardening |
| `perf` | Performance improvement |

### Examples

```
feat(auth): add JWT refresh token rotation
fix(api): return 404 instead of 500 for unknown user
docs(readme): add local setup instructions
refactor(db): extract connection pool into singleton
test(user-service): add edge cases for empty email
chore(deps): upgrade vitest to 2.1.0
```

### Rules

- Subject line: imperative mood, max 72 chars, no period at end.
- Body: explain *why*, not *what* — the diff shows what.
- Never commit directly to `main`.
- One logical change per commit — squash WIP commits before opening a PR.

---

## Pull Request Process

1. **Open a draft PR early** — lets CI run and gives reviewers early visibility.
2. **Fill out the PR template** — required checklist items must be checked before review is requested.
3. **Request review** — minimum 1 approving review required to merge.
4. **Address feedback** — respond to every comment (resolve or reply with rationale).
5. **Merge via Squash and Merge** — keeps `main` history clean.
6. **Delete the branch** — do this via the GitHub UI after merge.

### PR Size Guidelines

| Size | Lines Changed | Guidance |
|------|--------------|---------|
| XS | < 10 | Ideal — fast review, low risk |
| S | 10–100 | Good |
| M | 100–400 | Consider splitting if possible |
| L | 400–800 | Requires justification |
| XL | > 800 | Split required before review |

Large PRs are harder to review well and more likely to introduce bugs undetected.

---

## Release Process

1. Bump version in `package.json` / `pyproject.toml`.
2. Update `CHANGELOG.md` — move `[Unreleased]` items to a new version heading.
3. Open a PR: `chore: release v1.2.3`.
4. After merge, tag: `git tag -a v1.2.3 -m "Release v1.2.3"` and push the tag.
5. GitHub Actions will pick up the tag and publish/deploy.
