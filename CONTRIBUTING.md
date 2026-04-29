# Contributing

## Scope

This repository implements a stdio MCP server for legacy Jira Server and Jira Data Center environments, with Jira Server 7.7.1 compatibility as the main constraint.

Before changing behavior, assume compatibility is more important than abstraction.

## Compatibility rules

- target Jira REST API v2, usually `/rest/api/2`
- do not switch core logic to Jira Cloud `/rest/api/3`
- do not require `accountId`
- keep legacy username and `name` user flows working
- treat Agile endpoints as optional
- prefer clear failures over hidden compatibility guesses

## Safety rules

- keep `zod` validation on tool inputs
- never log secrets, cookies, passwords, tokens, or authorization headers
- preserve read-only defaults
- avoid destructive Jira operations in v1
- keep tool outputs concise, structured, and JSON-serializable

## Development workflow

```bash
npm install
npm run typecheck
npm run build
npm test
npm run pack:dry-run
```

## Implementation notes

- use strict TypeScript
- keep tools grouped by domain under `src/tools/`
- keep config validation centralized in `src/config.ts`
- document user-visible behavior changes in `README.md`
- prefer small focused changes over broad rewrites

## When updating docs

Keep the README useful for both:

- GitHub readers evaluating whether the project fits their Jira environment
- npm users copying a working MCP configuration quickly

If the package surface changes, update the tool catalog and setup examples in `README.md` and keep `examples/clients/` in sync in the same change.
