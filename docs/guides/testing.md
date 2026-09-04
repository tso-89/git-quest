# Testing Guide

> How we write and run tests in this project.

## Test Philosophy

> We test behaviour, not implementation. Tests are documentation that never goes stale.

- **Unit tests** — fast, isolated, no I/O. Test one function or class.
- **Integration tests** — test boundaries between components (e.g. service ↔ database).
- **E2E tests** — test critical user flows through the real stack.

## Running Tests

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:e2e          # E2E tests
pnpm test:coverage     # Generate coverage report
pnpm test:watch        # Watch mode during development
```

## Coverage Targets

| Type        | Minimum Coverage |
|-------------|-----------------|
| Statements  | 80%              |
| Branches    | 75%              |
| Functions   | 80%              |

Coverage is enforced in CI. New code should not reduce coverage.

## File Structure

```
src/
  user-service.ts
  user-service.test.ts   ← unit tests, collocated

tests/
  integration/           ← integration tests
  e2e/                   ← e2e tests
  fixtures/              ← test data factories
  helpers/               ← shared test utilities
```

## Writing Good Tests

### Naming
```typescript
// ✅ Good — describes the scenario
it('returns 404 when user does not exist')
it('throws AuthError when token is expired')
it('sends welcome email after successful registration')

// ❌ Bad — vague
it('works')
it('handles error')
it('test 1')
```

### Structure (AAA)
```typescript
it('returns the user when ID is valid', async () => {
  // Arrange
  const userId = 'user-123'
  const expectedUser = createUserFixture({ id: userId })
  vi.mocked(userRepository.findById).mockResolvedValue(expectedUser)

  // Act
  const result = await userService.getUser(userId)

  // Assert
  expect(result).toEqual(expectedUser)
})
```

### Mocking
```typescript
// Mock at the module boundary, not deep inside
vi.mock('./user-repository')
const mockRepo = vi.mocked(userRepository)

// Reset between tests
beforeEach(() => {
  vi.resetAllMocks()
})
```

## Test Fixtures / Factories

Use factories for test data — avoid hardcoded objects scattered across tests:

```typescript
// tests/fixtures/user.ts
export function createUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}
```

## CI Enforcement

Tests run on every PR. A PR cannot merge if:
- Any test fails
- Coverage decreases below threshold
- Test run times out (limit: 10 minutes)
