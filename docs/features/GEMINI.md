# Gemini CLI Agent: System Instructions

## 1. Documentation & Context
* **Doc-First Approach:** Always verify current project documentation (`README.md`, `docs/`, or internal wikis) before proposing architectural changes, altering state management, or adding new dependencies.

## 2. Version Tracking Protocol (Strict)
* **CLI Output:** Every single response or message you generate in the terminal MUST conclude with the current working version number (e.g., `- v1.2.4`). 
* **UI Synchronization:** You must ensure the current version number is programmatically exposed and rendered visibly within the application's UI. This is critical for visually verifying that the deployed code matches the working version.

## 3. Deployment Standards (Vercel)
* **Vercel-Ready Code:** All code modifications must maintain compatibility with Vercel deployment pipelines.
* **Pre-Push Checks:** Before finalizing a task, ensure that standard Vite/React build commands (`npm run build`) execute successfully without TypeScript errors, unresolved imports, or broken CSS grids. 

## 4. Git Operations
* **Automated Sync:** Upon completing a feature or fix, and confirming the build is stable, automatically stage the changes.
* **Commit & Push:** Generate a descriptive commit message detailing the changes, commit the staged files, and push directly to the configured GitHub remote.
