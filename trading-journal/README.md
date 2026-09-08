# Turbo Trading Journal

A local trading workspace with customizable trade characteristics, automatic completion rules, detailed analytics, and a daily journal. Built with React, TypeScript, Vite, and Electron.

## Run locally

For a ready-to-install Windows app, use the Setup.exe in `release/1.3.2/`.
Your friend needs only that file. It includes the runtime and starts an empty
journal on their PC. See `INSTALL-AND-UPDATE.txt` beside the installer and
[RELEASING.md](RELEASING.md) for future releases. Upgrades use a newer installer
over the current installation; completed trades, drafts, characteristics, and
journal pages stay in the same user-data folder.

Requires Node.js 24 or newer. From `trading-journal`:

```powershell
npm install
npm start
```

`npm start` builds the latest version and opens the desktop app independently of the terminal or development server. On Windows, you can also double-click **Start Turbo Journal.cmd** in the parent project folder.

For development with live updates, use `npm run dev` and leave that terminal open. For a browser-only preview:

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
9. Choose **Minimalist** beside the theme button to enter trades in a short horizontal strip. On desktop it docks above the taskbar and can shrink to 180 pixels tall, including the Windows title bar. Scroll the characteristics with the mouse wheel, trackpad, scrollbar, or Tab key. Save stays visible, and the unfinished-trade dropdown resumes entries. **Full mode** restores the previous window size without clearing trade edits. Your mode preference survives a restart; save a trade before closing to retain the entered values.
10. Use **Remove** on any characteristic in Settings, including defaults, to hide it from full and minimalist trade entry. Removed characteristics keep their definitions and old values. Expand **Removed characteristics** to restore them with their previous options and required rules. The master log still displays, searches, and exports historical values, including when an old trade is edited. Its Columns picker includes removed fields. Hover or focus a trade's notes icon for a preview; click it to read a longer note in a dialog.

The Windows title bar, taskbar, and installer use the orange-and-teal turbo icon. Its vector source is `public/turbo.svg`; run `node scripts/generate-icons.mjs` with Microsoft Edge installed to regenerate the PNG and multi-resolution ICO assets.

The master log defaults to the active characteristics in Settings. Removed fields
remain unchecked in **Columns**, where you can enable them to inspect historical
values. **Use active characteristics** resets the selection. CSV exports and
search still include historical values, even for columns hidden from the table.

## Defaults and completion

Required: date, time entered, time exited, long/short, contract, position size, PnL, account, and strategy.

The Long / short button starts at **LONG** on a new trade. Click it (or press Space when focused) to toggle to **SHORT**. Editing an existing trade preserves its saved direction.

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

The desktop app uses Electron's bundled `node:sqlite`, with WAL and full synchronous writes. No separately compiled SQLite addon is required. Its database is `trading_journal.db` in `%APPDATA%\trading-journal` on Windows. This directory is fixed for both development and installed builds, independently of the application name, version, or installation folder. A different app version creates a consistent SQLite snapshot in its `backups` subfolder before opening existing data. Settings shows the installed version and can open the data folder.

On the first run, the app imports the starter's existing `trades` and `custom_attributes` data into the new `journal_state` table in the same database. Original tables are retained, and this migration only runs once. Existing records are evaluated against the new completion rules.

The browser preview stores data in IndexedDB for its current browser profile and origin. Clearing site data removes it; export JSON backups to keep a separate copy. This is a local, single-user app, with no cloud synchronization or login. Use one browser tab for editing at a time.

Save errors are shown explicitly with a retry button. The app guards against leaving with unsaved trade edits or unfinished writes. Backup restoration validates the data and downloads a backup of the current workspace before replacing it.

## Validation and builds

```powershell
npm run build        # Type-check and build renderer + Electron main/preload
npm run lint         # ESLint with no warnings permitted
npm test             # Model, analytics, SQLite persistence and migration tests
npm run test:e2e      # Browser workflows, including the compact strip, using Microsoft Edge
npm run test:desktop  # Verify persistence, full restarts, and server-independent startup
npm run dist:win     # Build the Windows installer, sharing guide, and checksum
npm run test:release # Test the packaged app with an isolated data profile
npm run test:upgrade # Install/upgrade two isolated fixtures and verify data survives
```

For browser tests on a machine without Edge, change the Playwright channel in `playwright.config.ts` or install Playwright Chromium. Automated tests use isolated browser contexts and temporary desktop profiles; they do not edit your actual journal. Desktop test profiles remain in the operating system's temporary folder for inspection. Installer packaging is a separate step from the development build.

Core logic lives in `src/lib/model.ts` and `src/lib/analytics.ts`. `electron/store.ts` owns desktop storage and migration; `src/lib/storage.ts` provides the renderer bridge, browser storage, and exports.

## Import another trade log

Open **Import trades** in the menu and choose a CSV. Check the suggested column mappings, skip unwanted columns, or use **Add characteristic** beside a column to create a custom field (including its type, required flag, filter and analytics settings). New fields are staged until you import. Removed characteristics are not offered as mapping targets; restore them in Settings first if you want to append to their history.

Select the source date and number formats. Use separate date and time columns; ISO dates and 12/24-hour times are supported. Currency symbols and accounting negatives are accepted, but amounts are not converted between currencies. Percent fractions can optionally be multiplied by 100. Supply defaults for unmapped fields such as account or strategy.

Review the preview, edit cells, and uncheck unwanted rows. Invalid values block importing selected rows until corrected. Missing required fields are allowed and create unfinished trades. Exact duplicates (all nonblank values match) are skipped by default; turn that off to keep intentionally identical trades. Notes preserve their original case and line breaks; other text is capitalized. Existing trades and historical characteristics are retained.

The final **Import trades** button saves the selected trades and any new characteristics together. If saving fails, **Retry import** safely retries the same batch. Files are processed locally, with limits of 10 MB, 10,000 trades and 200 columns. UTF-8 CSVs and BOM-marked UTF-16 files are supported, with comma, semicolon or tab separators and quoted multiline cells.

## Dollars, points, and automated RR

Choose **PnL unit** on trade entry (including minimalist mode), or map that column in a CSV import. Existing trades and CSVs without a unit remain dollar entries. Point PnL is the **total across contracts**: closing two contracts for +10 points and one for +5 points produces +25 points. Dollar PnL = total point PnL times the contract multiplier; position size is not multiplied again. Include any fees in the entered net result if desired.

The dashboard selector displays **Dollars**, **Points**, or **Both**, and persists in Settings. Both shows a complete analysis in each unit with shared trade filters. Unknown conversions are explicitly excluded until a multiplier is configured. Original amounts, units, and timestamps are retained. Master-log PnL displays the recorded unit.

Settings has an **Automated characteristics** section with separate enabled, filter, and analyze switches:

- **Trade RR** = target distance / stop distance.
- **Realized RR** = point PnL / (stop distance times initial position size), equivalent to dollar PnL / initial dollar risk.

Ratios backfill automatically for existing trades and recalculate when inputs or multipliers change. A missing or zero stop, missing initial size, or unknown required conversion leaves the corresponding result blank. Use original stop distance and initial position size when scaling out. Disabling an automated characteristic hides it from entry and default master columns while retaining historical values through the Columns picker. They are read-only and never required to complete a trade.

Contract multipliers can be added or overridden in Settings. Defaults cover MNQ/NQ, MES/ES, M2K/RTY, MYM/YM, MCL/CL, and MGC/GC. Root, dated (MNQU26), and common continuous (@MNQ, MNQ1!) symbols are recognized case-insensitively; exact custom symbols take priority. These are USD per full point, not per tick. Currency labels do not perform FX conversion. Sources: [CME equity index specifications](https://www.cmegroup.com/articles/faqs/frequently-asked-questions-micro-e-mini-equity-index-futures.html), [CME WTI specifications](https://www.cmegroup.com/education/articles-and-reports/micro-wti-crude-oil-futures-faq), [CME gold specifications](https://www.cmegroup.com/education/lessons/product-gold).

## Color themes

Dark mode retains the midnight blue-teal background with teal and orange panel outlines. Light mode uses the reference teal blue (#01889F), mostly lavender panel outlines, and orange accents, with very little white. Both apply throughout the app and minimalist mode.

## Remembered filters

Dashboard and master trade log filters automatically stay at their last-used settings, independently for each page. Date ranges, characteristic rules, and master-log search text are saved locally with the journal and included in backups. They survive page changes, app restarts, and updates. Reset filters clears the remembered rules and dates for that page; clear the search box separately. There are no presets or profiles to manage. Date ranges remain the exact dates you selected.

## Prop account manager

**Account manager** links profiles to trade-log account names, ignoring case. Choose an existing name to enter its firm, starting balance/date, initial eval/funded stage, maximum drawdown, DLL and default payout share. Add a new account here to make its name available in trade entry. The opening balance applies immediately before trades at the selected local date/time; older trades stay in the journal but are not added again.

Record dated account purchases, subscriptions/fees, resets, funding/activation, payouts, balance reconciliations, observed live equity highs and closures. Edit or delete actions to correct the ledger. Reset and funding actions can establish a new trading balance and drawdown baseline while preserving all previous costs and trades. Same-time actions retain their recorded order and precede same-time trade closes.

Payouts keep the full **trading balance deduction** separate from **actual cash received**: a 1,000 deduction at 80% reduces the account by 1,000 and records 800 real cash received. Override cash received to match the deposit; avoid counting a withheld fee twice. Real costs never silently reduce trading PnL. Net real cash = actual payouts minus purchase, reset, activation and other cash costs. Trade PnL uses the configured dollar/point multiplier and only completed, dated trades with a usable conversion. Unfinished or unconvertible records are called out.

The page supports an as-of date, a chronological ledger with running balances, and CSV ledger export. Managed accounts and actions are part of normal SQLite/browser storage and JSON backups and survive upgrades. The dashboard's account overview summarizes all managed accounts through today independently of trade filters. Starting balance affects account equity, not profit factor (gross profit / gross loss).

Drawdown estimates support **static**, **EOD trailing**, and **live trailing**. Static starts from the current reset/funding cycle's baseline. EOD uses prior calendar-day closing balances; today's closing threshold remains provisional. Live uses logged closing-balance highs plus manually recorded observed equity highs. Neither live unrealized PnL nor firm-specific session boundaries/capped trailing rules are inferred. DLL uses selected-calendar-day net closed-trade losses. These estimates should be compared with the firm's reported limits; they are not live breach monitoring.

## Pin on top

Use the pin icon beside **Minimalist** to keep the desktop journal above other windows. Click it again to unpin. It works in full and minimalist mode, remembers the setting across restarts, and does not move or resize the window. Pinning is available in the desktop app; browsers cannot pin their native window from a page.

### Trading days

Settings > Trading day sets the end time (default 15:00). Entries strictly after the cutoff count toward the next date, including weekends. The dashboard calendar, daily PnL chart, dashboard date range, and daily journal trade summary use this rule, including for existing trades. Written journal pages and original trade dates/times are unchanged. The master log retains calendar date filters and defaults to descending date, then descending entry time.
