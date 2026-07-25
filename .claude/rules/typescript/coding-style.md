---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---
# TypeScript Coding Style

## Types

- Add parameter and return types to exported functions
- Let TypeScript infer obvious local variable types
- Use `interface` for object shapes, `type` for unions/intersections/mapped types
- Prefer string literal unions over `enum`
- Avoid `any` — use `unknown` and narrow safely
- Define React component props with a named `interface` or `type`; do not use `React.FC`
- No `console.log` in production code — use the structured logger
