---
description: Standard Development Workflow
---

For every code change in this repository, the following steps must be followed:

1. **Test Coverage**: Create or update unit/integration tests to cover the modifications if there is a significant enough change
2. **Verification**: Run the full test suite (`npm run test` or `npx vitest run`) to ensure zero regressions.
3. **Documentation**: Update `docs/TESTS.md` with:
   - Newly added test cases.
   - The updated total test count.
