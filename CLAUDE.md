# CLAUDE.md

## Project

WebMyCar is a macOS desktop application built with:

- Tauri v2
- React
- TypeScript
- Rust
- SQLite

The product goal is to manage personal vehicle data locally with a clean desktop UX.

## Product priorities

1. reliability of stored data
2. simple and clear UI
3. maintainable code
4. local-first architecture
5. future compatibility with a financial app bridge

## V1 scope

- vehicle records
- odometer history
- fuel tracking
- maintenance tracking
- reminders
- document attachments
- dashboard

## Development principles

- Make the smallest correct change.
- Read existing code before editing.
- Preserve consistency with existing patterns.
- Do not refactor unrelated code in the same task.
- Prefer implementation over speculation.
- Avoid unnecessary dependencies.

## Code style

### React / TypeScript

- Use typed props and typed return values when helpful.
- Prefer simple state flows.
- Keep business logic out of large page components when possible.
- Avoid over-engineered hooks.

### Rust / Tauri

- Keep commands explicit.
- Keep DB logic centralized.
- Validate inputs.
- Prefer clear error messages.

## Data conventions

- money in cents
- ISO dates for business data
- UUID ids
- SQLite migrations for schema evolution

## UX conventions

- desktop-oriented layouts
- explicit actions
- clean empty states
- readable tables
- no hidden critical behavior

## Expected workflow

When working on a task:

1. inspect files first
2. summarize current behavior
3. propose a focused plan
4. implement changes
5. list files changed
6. mention checks performed

## Constraints

- Do not rewrite large sections without necessity.
- Do not rename files or folders casually.
- Do not add dependencies unless the gain is clear.
- Do not change database schema without a migration.

## Language conventions

- All user-facing text must be written in French.
- All code identifiers must remain in English.
- Do not translate technical identifiers, database fields, file names, or function names.
- Use natural and consistent French wording in the UI.
