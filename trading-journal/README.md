# Turbo Trading Journal

A local trading workspace with customizable trade characteristics, automatic completion rules, detailed analytics, and a daily journal. Built with React, TypeScript, Vite, and Electron.

## Run locally

Requires Node.js 24 or newer. From `trading-journal`:

```powershell
npm install
npm run dev
```

`npm run dev` opens the desktop app. For a browser-only preview:

```powershell
npm run dev:web
```

Open http://127.0.0.1:5173. Both commands use the same port, so run one at a time. The desktop app and browser preview keep separate data. Use Settings → Export backup / Restore backup to move data between them.

## Try the workflows

1. Choose **Explore sample data** on the dashboard to add 64 explicitly marked sample trades and a Mood characteristic. Settings can remove only the sample trades later.
2. On **Trade log**, enter any trade details and save. Missing required fields leave the trade in the unfinished queue. Finish it there to move it into the **Master trade log** and analytics.
3. Edit or delete completed trades from the master log. You can search all active characteristics, filter records, choose visible columns, sort, paginate, and export the filtered result to CSV.
4. In **Settings**, add text/dropdown, decimal, integer, percentage, score, date, or time characteristics. Configure numeric bounds, score ranges, suggested options, required status, filtering, and automatic analysis. Text entries are uppercase and remember new options without case duplicates. Existing trades and backups follow the same rules, so `mnq`, `MNQ`, and `Mnq` share one analytics group. Notes and daily journal text keep their original case and spacing. Custom characteristics can be archived and restored without losing their values.
5. Use **Dashboard** filters together to narrow by dates, strategy, contract, mood, or numeric ranges. The main breakdown defaults to **Strategy × Contract**. Every enabled characteristic gets its own expandable breakdown. Numeric fields with more than eight unique values use five equal-width ranges; missing values get a separate group.
6. On **Daily journal**, choose a date and write. Edits save automatically; use the arrows, date picker, or saved pages to browse. There is no application-imposed text length limit.
7. Browse the dashboard's **Trading calendar** by month to see each day's net PnL, completed trade count, win rate, and strategies used. It respects all dashboard filters. Select a trading day for full details. Trades without PnL count toward the trade total but are excluded from PnL and win rate.
8. Switch between **Midnight drive** (dark) and **Race day** (light) using the sidebar or Settings. Both use teal and racing orange, with a turbocharger emblem.

## Defaults and completion

Required: date, time entered, time exited, long/short, contract, position size, PnL, account, and strategy.

Optional: stop loss and take profit in points, confidence and execution scores (1–5), notes, DD ratio (%), MHP/HP/HG resilience (−150 to +150 with decimals), and setup grade.

Completion is derived from current settings, rather than a stored flag. Adding a required field can move existing trades back to the unfinished queue. Blank values are distinct from zero; a zero PnL is a valid breakeven trade. Invalid entered numbers, scores, dates, and times are rejected by the trade form. Default field types remain fixed to preserve the meaning of core statistics; you can edit their required/filter/analyze flags and numeric ranges. Archived custom values remain in backups.

## Analytics definitions

- Net PnL is the sum of the values entered; enter a result including costs if you want net-of-fee statistics.
- Win rate is wins divided by all trades with PnL, including breakeven trades.
- Profit factor is gross profit divided by absolute gross loss. Profits with no losses show infinity; no profit and no loss show a dash.
- Expectancy is average PnL per trade. Additional metrics include gross profit/loss, average win/loss, best/worst trade, longest winning/losing streaks, and average hold time.
- Equity and maximum drawdown are computed in entry-date/time order from a starting cumulative PnL of zero. Drawdown includes an initial losing trade.
- If PnL is made optional, completed trades without PnL are counted separately and excluded from monetary statistics.
- Earlier exit times mean the next day. Holding time supports trades lasting less than 24 hours.
- Currency is a display setting; values are not converted. Keep recorded PnL in a consistent currency.

## Storage and migration

The desktop app uses Electron's bundled `node:sqlite`, with WAL and full synchronous writes. No separately compiled SQLite addon is required. Its database is `trading_journal.db` in Electron's user-data directory (normally `%APPDATA%\trading-journal` during development).

On the first run, the app imports the starter's existing `trades` and `custom_attributes` data into the new `journal_state` table in the same database. Original tables are retained, and this migration only runs once. Existing records are evaluated against the new completion rules.

The browser preview stores data in IndexedDB for its current browser profile and origin. Clearing site data removes it; export JSON backups to keep a separate copy. This is a local, single-user app, with no cloud synchronization or login. Use one browser tab for editing at a time.

Save errors are shown explicitly with a retry button. The app guards against leaving with unsaved trade edits or unfinished writes. Backup restoration validates the data and downloads a backup of the current workspace before replacing it.

## Validation and builds

```powershell
npm run build        # Type-check and build renderer + Electron main/preload
npm run lint         # ESLint with no warnings permitted
npm test             # Model, analytics, SQLite persistence and migration tests
npm run test:e2e      # Nine browser workflow tests using installed Microsoft Edge
npm run test:desktop  # Build and verify Electron persistence across full restarts
npm run dist         # Build an installable desktop package with electron-builder
```

For browser tests on a machine without Edge, change the Playwright channel in `playwright.config.ts` or install Playwright Chromium. Automated tests use isolated browser contexts and temporary desktop profiles; they do not edit your actual journal. Desktop test profiles remain in the operating system's temporary folder for inspection. Installer packaging is a separate step from the development build.

Core logic lives in `src/lib/model.ts` and `src/lib/analytics.ts`. `electron/store.ts` owns desktop storage and migration; `src/lib/storage.ts` provides the renderer bridge, browser storage, and exports.
