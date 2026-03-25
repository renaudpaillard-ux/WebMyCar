# AGENTS.md

## Project overview

WebMyCar is a macOS desktop application for personal vehicle management.

Core scope for V1:

- vehicles
- odometer entries
- fuel entries
- maintenance entries
- reminders
- documents
- dashboard

Tech stack:

- Tauri v2
- React
- TypeScript
- Vite
- Rust
- SQLite

## Working rules

- Prefer small, focused changes.
- Do not introduce major dependencies without clear justification.
- Keep the UI simple and desktop-oriented.
- Prefer explicit code over clever abstractions.
- Keep business rules easy to understand and test.
- Ask before changing project structure drastically.
- Preserve existing naming unless there is a clear consistency issue.

## Frontend rules

- Use TypeScript everywhere.
- Prefer function components.
- Keep components short and focused.
- Co-locate feature code when practical.
- Avoid premature generic abstractions.
- Prefer readable forms over highly dynamic form systems.
- Use existing UI patterns before introducing new ones.

## Backend / Tauri / Rust rules

- Keep SQLite access centralized.
- Prefer clear commands and DTOs.
- Validate critical business rules server-side.
- Use migrations for schema changes.
- Do not mix unrelated concerns in the same Rust module.

## Data rules

- Store money in cents.
- Store business dates as `YYYY-MM-DD`.
- Use UUIDs for entity identifiers.
- Maintain foreign keys and avoid silent cascade surprises unless explicitly intended.

## UX rules

- Desktop first, mouse and keyboard friendly.
- Use double-click only where it is a clear enhancement, never as the only action.
- Favor tables for history screens.
- Favor cards only for summary and dashboard views.
- Always handle empty states cleanly.

## Safety rules for modifications

Before implementing:

1. inspect the relevant files
2. explain the intended change briefly
3. implement the minimum viable change
4. mention any follow-up work if needed

## Testing / validation

After any non-trivial change:

- run the relevant build or checks
- report what was verified
- mention what was not verified

## Output style

When proposing code changes:

- be concrete
- reference files precisely
- avoid long theoretical explanations

## Language rules

- All user-facing text MUST be written in French:
  - page titles
  - navigation labels
  - buttons
  - form labels
  - placeholders
  - empty states
  - user messages

- All code MUST remain in English:
  - variable names
  - function names
  - file names
  - database schema
  - TypeScript and Rust types

- Do NOT translate technical identifiers into French.

- If existing UI text is in English, it should be converted to French unless explicitly stated otherwise.
- Use natural and consistent French wording (avoid literal translations).
