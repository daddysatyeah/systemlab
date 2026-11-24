# SystemLab test report

Final verification ran on November 24, 2026, on Windows with Node.js 26.13.1 and approximately 8 GB of physical RAM. Browser tests used Playwright 1.65.1 and bundled Chromium against the production build served at `/systemlab/`.

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Passed |
| ESLint | `npm run lint` | Passed |
| Unit and integration tests | `npm test` | 23 passed across 2 files |
| Production build | `npm run build` | Passed with no build warnings |
| End-to-end browser tests | `npm run test:browser` | 15 passed in the release repository |
| Dependency audit | `npm audit` | 0 vulnerabilities reported |

## Release verification

- A plain static server with no route rewrites served `/systemlab/`. Chromium opened Studio directly, reloaded it, navigated to Docs, and reloaded Docs. Every observed request stayed under the project base, including the lazy Studio chunk.
- The release suite ran all eight scenarios, compared all nine displayed metrics with a fresh engine run, and exercised controls, storage, navigation, JSON and SVG downloads, and malformed imports.
- A pattern scan of the release files and built assets found no known credential patterns or personal workspace paths. The nine sample screenshots contained no PNG text or EXIF metadata.
- The clean installation reported deprecation notices for the existing Recharts 2 and ESLint 9 releases. The locked versions were retained.
- GitHub Actions and the public site remain unverified because an authenticated publishing account was unavailable.

## Studio rendering regression

Simulation ticks rebuilt the controlled React Flow nodes without the dimensions React Flow had measured. React Flow discarded the node measurements and handle bounds, which hid the nodes and prevented the edges from rendering. Canvas dimensions and viewport position remained stable during the failure. The editor now preserves measured dimensions across controlled updates.

Browser coverage checks every scenario before, during and after pausing a live run. It verifies complete in-bounds node placement, edge counts, packet positions along the SVG paths, and that packet animation stops on pause. A fresh deterministic engine run at the same simulated time provides expected values for all nine displayed metrics. Replication dispatch also emits packets for the replica connection.

The browser run exercised each component configuration field and the simulation seed, all speed and chart metric options, project operations, and navigation. The preceding screenshot run captured the [full homepage and eight running scenarios](screenshots/final/) across light and dark themes.

## Feature acceptance checklist

- [x] Landing page, interactive architecture preview, feature and scenario navigation, Learning Center, and theme persistence.
- [x] Eleven infrastructure component types are available in the studio. Tests exercise routing, processing, caching, rate limiting, rejection, queue dispatch, replication, and component outages.
- [x] Canvas supports library clicks and drag-and-drop, output-to-input connections, inspector connections, node moves, selection, duplication, deletion, undo, redo, pan, zoom, and fit.
- [x] Simulator supports start, pause, resume, step, adjustable speed, stop, and reset. Unit tests check deterministic seeded execution, round robin, least connections, and successful recovery.
- [x] Live metrics come from engine events. Tests cover completion and timeout accounting, percentiles, queue depth, utilization inputs, traffic splits, caching, and failure visibility.
- [x] All eight built-in scenarios run, produce successful requests, and reproduce metrics and event logs given the same seed and topology. Focused tests check scenario-specific outcomes.
- [x] Local projects can be created, renamed, duplicated, cleared, and deleted with confirmation. Browser tests cover refresh persistence, valid and malformed JSON imports, JSON downloads, and standalone SVG downloads.
- [x] Invalid configurations and topologies are rejected. Tests cover missing components, disconnected nodes, duplicate routes, routing cycles, oversized files, and storage exceptions.
- [x] Chromium tests cover mobile navigation and check for horizontal overflow from 320 px through 1440 px. Desktop landing, running studio, and the mobile landing page were visually inspected using browser screenshots.
- [x] Browser tests monitor console warnings, console errors, and uncaught page errors. The final run recorded none in the tested pages.
- [x] Startup, static hosting instructions, architecture, metric definitions, and modeling limits are documented.

During verification, browser tests exposed overflow in the header and simulation toolbar on narrow screens and inconsistent keyboard selection in the canvas. The layout and controlled selection handling were corrected before the final passing run. An early browser run also overlapped a build that replaced its served files. Final release checks built the application before starting browser tests.

Firefox, Safari, physical mobile devices, and live deployment to a hosting provider were outside the executed verification. See [ARCHITECTURE.md](ARCHITECTURE.md) for simulator limits.
