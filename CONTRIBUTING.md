# Contributing to @agent-governance-sdk/sdk

We welcome contributions. This project is MIT licensed and intended as a community standard for AI agent governance.

## Development

```bash
git clone https://github.com/agent-governance-sdk/sdk.git
cd sdk
npm install
npm test
```

## Guidelines

- Zero runtime dependencies. The SDK should not add dependency surface area to the applications it governs.
- All adapter methods must be async.
- Governance failures must be non-fatal — audit log write failures should never break the pipeline being governed.
- Tests must pass before PR merge.

## Adding a new adapter

1. Create `src/adapters/your-adapter.js`
2. Extend `GovernanceAdapter` from `src/adapters/index.js`
3. Implement all five methods
4. Add tests in `test/`
5. Add the export to `package.json` exports map

## Adding a framework integration

1. Create `src/adapters/framework-name.js`
2. Follow the pattern in `langchain.js` — a thin wrapper that routes through `auditLog.wrap()`
3. Add an example in `examples/`
4. Add the export to `package.json` exports map
