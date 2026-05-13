# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repository hosts **BMRBdep**, the BMRB NMR-STAR deposition server that replaced ADIT-NMR. It has two halves plus shared orchestration:

- `FrontEnd/` — Angular 20 SPA. Most app code lives here.
- `BackEnd/bmrbdep/` — Python Flask + uWSGI API the frontend talks to (mounted at `/deposition`).
- `BackEnd/schema/` — NMR-STAR schema loader; produces the schema JSON the frontend consumes.
- `Dockerfile`, `docker-compose.yml`, `build_angular.sh`, `install.sh`, `run_locally.sh`, `upgrade.sh` — deployment/dev orchestration scripts at the repo root that operate on both halves.

When making frontend-only changes you typically work inside `FrontEnd/`, but builds and local dev are usually invoked from the repo root.

## Common commands

`npm`/`ng` commands run from `FrontEnd/`. The repo-root scripts (`run_locally.sh`, `build_angular.sh`) handle the cd for you. Production builds also expect a Python venv in `BackEnd/` for the schema loader.

**Node is not on the system `PATH`.** Before any `npm`/`ng` command, run `source FrontEnd/node_env/bin/activate` in the shell — that nodeenv puts `node`/`npm` on `PATH`. Without it `npm` is "command not found."

| Task | Command (run from) |
| --- | --- |
| Local dev (frontend + backend together) | `./run_locally.sh` (repo root) |
| Dev server only | `npm start` (`FrontEnd/`) — alias for `ng serve --hmr`, http://localhost:4200 |
| Production build | `npm run build.prod` (`FrontEnd/`) — runs `git.version.ts` prebuild, then `ng build --configuration production` |
| Devprod build (prod-like but with devprod env) | `ng build --configuration=devprod` (`FrontEnd/`) |
| Lint | `npm run lint` (`FrontEnd/`) — ESLint via `FrontEnd/eslint.config.js` |
| Unit tests | `npm test` (`FrontEnd/`) — Karma + Jasmine, see `FrontEnd/karma.conf.js` |
| Full deploy build | `./build_angular.sh` or `./build_angular.sh production` (repo root) |

The dev server proxies nothing — `FrontEnd/src/environments/environment.ts` hardcodes `http://localhost:9000/deposition` as the API root, so the Flask backend must be running locally for any deposition flow to work. On `*bmrb*` hostnames the API root becomes the relative `/deposition`.

There are three environment files in `FrontEnd/src/environments/`: `environment.ts` (dev), `environment.devprod.ts`, `environment.prod.ts`. `production: true` in any of them disables `console.log`/`warn` and freezes `console`.

## Architecture

### Standalone bootstrap, not NgModule
The app is bootstrapped via `bootstrapApplication(AppComponent, ...)` in `FrontEnd/src/main.ts` with all Material modules imported through `importProvidersFrom(...)`. There is no root `AppModule`. Components are standalone and declare their own `imports:` arrays. `AppRoutingModule` is the only remaining `@NgModule` and is imported via `importProvidersFrom`.

### Routes (`FrontEnd/src/app/app-routing.module.ts`)
Top-level routes: `/` (welcome), `/entry`, `/entry/load/:entry`, `/entry/saveframe/:saveframe_category`, `/entry/review`, `/entry/restore`, `/entry/pending-verification`, `/help/molecular-assembly`, `/support`, `/my-depositions`. Most editing happens inside `SaveframeEditorComponent`, keyed by saveframe category.

### Core domain model (`FrontEnd/src/app/nmrstar/`)
The frontend implements its own in-memory NMR-STAR model. **Read these to understand anything non-trivial:**

- `entry.ts` — `Entry` is the root aggregate. It owns `saveframes`, the `Schema`, the `DataFileStore`, validation state (`valid`, `firstIncompleteCategory`), and the commit history used for conflict detection. `entryFromJSON()` hydrates from server JSON.
- `saveframe.ts` — `Saveframe` holds tags + loops for one NMR-STAR saveframe category. Validation, display rules (`'Y'`/`'N'`/`'H'`), and category navigation (`nextCategory`/`previousCategory`) live here.
- `loop.ts` — `Loop` is a table of `LoopTag` rows inside a saveframe.
- `tag.ts` — `SaveframeTag` and `LoopTag`. All tag validation, enumerations, and "interlinked" tag logic (one tag's value enabling/disabling another) lives here.
- `schema.ts` — Parsed NMR-STAR schema describing what saveframes/tags exist, types, mandatory-ness, supergroup ordering for the sidebar tree. Schema is fetched once with the entry and cached in `localStorage`.
- `dataStore.ts` — Tracks uploaded data files and which saveframe category each is assigned to.
- `nmrstar.ts` — Free functions: `cleanValue` (NMR-STAR quoting rules), `checkValueIsNull`, `download`, `isMixedCase`.

`Entry.refresh()` re-runs validation and rebuilds the category tree; call it after any structural change. `Entry.print()` serializes to NMR-STAR text for deposition.

### ApiService is the persistence engine (`FrontEnd/src/app/api.service.ts`)
`ApiService` is the single owner of the active deposition. Key behaviors to be aware of before changing it:

- **`entrySubject: ReplaySubject<Entry>`** — every component subscribes to this to get the current entry. Pushing a new `Entry` or `null` is how you trigger global re-render.
- **Local cache + auto-save loop** — entries (and the schema) are serialized to `localStorage` under `entry`/`entryID`/`schema`. A `setInterval` (every 5s) detects `cachedEntry.unsaved` and `PUT`s to `${serverURL}/${entryID}`.
- **Cross-tab guard** — a 100ms interval compares `localStorage.entryID` to the in-memory entry; mismatch → sign out the current tab and route to `/`.
- **Commit-based conflict resolution** — every server response includes a `commit` hash. `Entry.commit` is a sliding window of the last 15. On load, `checkLastCommit()` decides whether to reuse the cached entry or refetch. On save, if the server replies with `{error: 'reload'}` the user is prompted to either pull server changes or force-push local (`force: true`).
- **Error handling** — `handleError()` surfaces `error.error.error` from the backend to `MessagesService`; in non-production it re-throws so it shows in the console.

If you add a new mutation, the pattern is: mutate `cachedEntry`, call `entry.refresh()`, then `this.storeEntry(true)` to mark dirty (the save loop picks it up). Don't call `saveEntry()` directly unless you need an immediate flush.

### UI shell
`AppComponent` owns the layout: a `MatToolbar`, a `MatSidenav` containing `TreeViewComponent` (the supergroup/category tree built from `entry.superGroups`), and a `RouterOutlet`. `SidenavService` exposes the sidenav reference so child components can open/close it. `MessagesService` drives the snack bar.

## Code conventions

- **ESLint + angular-eslint.** Config in `FrontEnd/eslint.config.js` (flat config, ESLint 9). Stock `tseslint.configs.recommended` + `stylistic` + `angular.configs.tsRecommended`. `npm run lint` currently surfaces ~220 pre-existing issues (largely `eqeqeq` in templates, `prefer-inject`, and `no-explicit-any`) — see `FrontEnd/CLEANUP_TODO.md`.
- **Component prefix is `app-`** (set in `FrontEnd/angular.json` schematics and enforced by `@angular-eslint/component-selector`).
- Component default style is `css` (not scss) per `FrontEnd/angular.json`, even though the global theme is `styles.scss`.
- `target: ES2022`, `module: es2020`, `moduleResolution: bundler`. `experimentalDecorators: true` (Angular still needs it).
- RxJS 7 — use the object-form `subscribe({ next, error })` and pipeable operators from `rxjs/operators`. Positional `subscribe(fn, fn)` is deprecated and removed in v8.

## Things that will bite you

- **Don't mutate an `Entry` without calling `refresh()`** — validation flags, the category tree, and `firstIncompleteCategory` will be stale and the sidebar/tree will show wrong state.
- **`localStorage` is the source of truth across reloads.** If you change the shape of what `Entry.toJSON()` produces, you must either bump a version field or handle older cached entries (see the `commit`-as-string upgrade shim in `entryFromJSON` for the pattern).
- **Schema is large.** `Schema.cleanUp()` deletes the un-parsed fields after first serialization to keep `localStorage` under quota; if you need a field post-cleanup, add it to the survivors in `toJSON()` first.
- **Backend URL is environment-derived at module load** (`FrontEnd/src/environments/environment.ts` inspects `window.location.hostname`). Don't hardcode `/deposition` or `localhost:9000` elsewhere.
- **Production builds disable `console.log` and `console.warn`** (but not `console.error`) and `Object.freeze(console)`. Don't rely on logs to debug a prod build.
- **`build_angular.sh` checks `id -u == 17473`** (bmrbsvc) — it's intended for the deploy host, not local laptops. Use `npm run build.prod` directly when iterating.
