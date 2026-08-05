# Tasks: Adopt DDD/hexagonal contexts and enforce 80% app coverage

> Reference plan: [`docs/superpowers/plans/2026-08-04-ddd-hexagonal-and-test-coverage.md`](../../../../docs/superpowers/plans/2026-08-04-ddd-hexagonal-and-test-coverage.md)

## 1. Open the change

- [x] 1.1 Author proposal, design, tasks, and architecture spec delta
- [x] 1.2 Validate the four-file change shape with `find .openspec/changes/ddd-hexagonal-coverage -type f`
- [x] 1.3 Commit the proposal as `docs(sdd): propose DDD hexagonal migration and coverage gate`

## 2. Capture coverage baselines without thresholds

- [ ] 2.1 Add `@vitest/coverage-v8` as a web dev dependency
- [ ] 2.2 Add temporary `test:coverage:baseline` scripts in both apps
- [ ] 2.3 Run API baseline and record the four totals
- [ ] 2.4 Run web baseline and record the four totals
- [ ] 2.5 Confirm coverage reports are ignored
- [ ] 2.6 Commit as `chore(deps): add per-app coverage baseline tooling`

## 3. Add characterization tests for existing behavior

- [ ] 3.1 Add failing user-service cases for filter, pagination, update, not-found, and remove
- [ ] 3.2 Add auth refresh/logout cases for missing, revoked, expired, and rotation
- [ ] 3.3 Add e2e regression for refresh and logout
- [ ] 3.4 Add deterministic web tests for api-client, server actions, and middleware
- [ ] 3.5 Run all characterization tests
- [ ] 3.6 Re-run baselines and record improvements
- [ ] 3.7 Commit as `test(root): characterize auth and users before architecture migration`

## 4. Enforce architecture boundaries with existing ESLint tooling

- [x] 4.1 Add API domain/application restrictions
- [x] 4.2 Add web domain/application restrictions
- [x] 4.3 Verify each rule fails on a forbidden import and is restored
- [x] 4.4 Verify clean lint for both apps
- [x] 4.5 Commit as `chore(config): enforce hexagonal dependency direction`

## 5. Build the API users domain with pure tests

- [x] 5.1 Write failing value-object tests from current contracts
- [x] 5.2 Run and confirm RED
- [x] 5.3 Implement framework-free value objects
- [x] 5.4 Define `User` entity and `UserRepositoryPort`
- [x] 5.5 Run domain tests and lint
- [x] 5.6 Commit as `feat(api): add users domain model and repository port`

## 6. Build users application use cases with in-memory ports

- [x] 6.1 Create `InMemoryUserRepository` covering list, find, update, and remove
- [x] 6.2 Write failing use-case tests
- [x] 6.3 Implement minimal use cases
- [x] 6.4 Run application tests
- [x] 6.5 Commit as `feat(api): add users application use cases`

## 7. Add the Prisma users adapter and mapper

- [x] 7.1 Write mapper round-trip tests
- [x] 7.2 Implement `PrismaUserMapper`
- [x] 7.3 Write repository tests against mocked `PrismaService`
- [x] 7.4 Implement `PrismaUserRepository`
- [x] 7.5 Run adapter tests and lint
- [x] 7.6 Commit as `feat(api): add Prisma users repository adapter`

## 8. Swap the users HTTP adapter and composition root

- [x] 8.1 Write controller tests with mocked use cases
- [x] 8.2 Implement a thin inbound controller
- [x] 8.3 Wire `UsersContextModule` with explicit providers
- [x] 8.4 Swap `AppModule` to the new module
- [x] 8.5 Run unit and users e2e tests
- [x] 8.6 Remove legacy `modules/users` after verification
- [x] 8.7 Commit as `refactor(api): migrate users to a hexagonal context`

## 9. Build auth ports and application use cases

- [x] 9.1 Define framework-free auth ports
- [x] 9.2 Test TTL parsing using current defaults
- [x] 9.3 Write RED tests for register and login
- [x] 9.4 Write RED tests for refresh and logout
- [x] 9.5 Implement minimal use cases
- [x] 9.6 Run auth inner-layer tests and lint
- [x] 9.7 Commit as `feat(api): add auth ports and application use cases`

## 10. Implement auth infrastructure adapters

- [x] 10.1 Write Argon2 round-trip tests
- [x] 10.2 Implement `Argon2PasswordHasherAdapter`
- [x] 10.3 Write JWT claims tests
- [x] 10.4 Implement `JwtAccessTokenIssuerAdapter`
- [x] 10.5 Test and implement token generation/hash
- [x] 10.6 Test and implement Prisma adapters
- [x] 10.7 Run adapter tests and lint
- [x] 10.8 Commit as `feat(api): add auth infrastructure adapters`

## 11. Swap the auth HTTP adapter and composition root

- [x] 11.1 Write controller tests around existing contracts
- [x] 11.2 Implement the thin controller
- [x] 11.3 Move and test the JWT strategy
- [x] 11.4 Wire every port explicitly in `AuthModule`
- [x] 11.5 Swap `AppModule` and run auth e2e
- [x] 11.6 Remove legacy `modules/auth` and run full validation
- [x] 11.7 Commit as `refactor(api): migrate auth to a hexagonal context`

## 12. Migrate web auth to ports and adapters

- [x] 12.1 Define framework-free web ports
- [x] 12.2 Write RED use-case tests with fakes
- [x] 12.3 Implement minimal application use cases
- [x] 12.4 Test and implement infrastructure adapters
- [x] 12.5 Move forms as presentation adapters
- [x] 12.6 Refactor server actions and API client into composition roots
- [x] 12.7 Refactor middleware without changing the matcher
- [x] 12.8 Run web tests, lint, typecheck, and build
- [x] 12.9 Remove legacy form files and verify no stale imports
- [x] 12.10 Commit as `refactor(web): migrate auth to ports and adapters`

## 13. Enforce independent 80% coverage gates

- [x] 13.1 Configure the API gate with thresholds and explicit `collectCoverageFrom`
- [x] 13.2 Replace the API baseline script
- [x] 13.3 Configure the web gate with provider and thresholds
- [x] 13.4 Replace the web baseline script
- [x] 13.5 Add the aggregate root command
- [x] 13.6 Run each gate independently and add tests if needed
- [x] 13.7 Prove failure semantics by temporarily raising one threshold
- [x] 13.8 Run the aggregate gate
- [x] 13.9 Commit as `test(root): enforce 80 percent coverage per app and metric`

## 14. Integrate the gate and document the final architecture

- [x] 14.1 Add the aggregate gate to CI
- [x] 14.2 Update contributor validation commands
- [x] 14.3 Update `ARCHITECTURE.md` to the implemented state
- [x] 14.4 Record ADR-012 (vertical bounded contexts) and ADR-013 (independent 80% coverage)
- [x] 14.5 Update the ADR index and OpenSpec checklist
- [x] 14.6 Run the complete Definition of Done
- [x] 14.7 Commit as `docs(sdd): document hexagonal contexts and coverage enforcement`

## 15. Post-merge OpenSpec archival

- [ ] 15.1 Move the approved spec delta into `.openspec/specs/architecture/`
- [ ] 15.2 Append a changelog entry
- [ ] 15.3 Remove the completed change folder
- [ ] 15.4 Validate archival with `pnpm harness:check` and clean status
- [ ] 15.5 Commit as `docs(sdd): archive DDD hexagonal coverage change`
