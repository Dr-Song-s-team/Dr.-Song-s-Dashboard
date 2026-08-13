@AGENTS.md

# Definition of Done

Before reporting any task complete, run `npm run check` and it must exit 0. `npm test` alone is not sufficient.

The `npm run check` command runs:
1. `tsc --noEmit` - TypeScript type checking
2. `eslint` - Linting
3. `npm test` - Full test suite
