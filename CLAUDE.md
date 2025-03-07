# CLAUDE.md - Agent Instructions

## Description
A simple RPA Application

## Build/Test/Lint Commands
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Test (all): `npm run test`
- Test (single): `npm test -- -t "test name"` or `npm test -- path/to/test.js`
- Watch mode: `npm run dev`

## Code Style Guidelines
- **Formatting**: Follow Prettier defaults, 2 space indentation
- **Imports**: Group imports (external libs first, then internal modules)
- **Types**: Use TypeScript for type safety, explicit return types on functions
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **Components**: Prefer functional components with hooks over class components
- **Error Handling**: Use try/catch blocks for async code, provide meaningful error messages
- **Documentation**: JSDoc for public APIs, inline comments for complex logic

## Requirements
- App should be written in Svelte and TypeScript
- App name is Rpage
- App should have a logo (use svg to generate a sleek, modern logo)
- App should utilize playwright in headless mode
- App should be dark mode, responsive
- App should show running automations
- App should allow adding and removing automations
- App should allow editing existing automations
- App should allow API calls to directly add, remove, update, list, and run automations
- App should be written in Svelte

*This file will be updated as project conventions evolve.*