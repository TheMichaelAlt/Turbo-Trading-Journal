The Turbo Trading Journal is a lightweight desktop application to log and analyze your trades, as well as journal your daily summary and notes on each trade you take.

It is completely free, open source, and runs locally on your device for complete data privacy.

To install or share the Windows application, use [Turbo Trading Journal 1.0.0 Setup](trading-journal/release/1.0.0/Turbo%20Trading%20Journal-Windows-1.0.0-Setup.exe). Your friend needs only this installer; Node.js and the source project are not required. [Installation and upgrade instructions](trading-journal/release/1.0.0/INSTALL-AND-UPDATE.txt) are included alongside it. Newer installers update the app while keeping trades and journal data in the same Windows user-data folder.

For local development, double-click **Start Turbo Journal.cmd** in this folder. It builds the latest edits and opens the desktop app without requiring a development server to stay running. Node.js 24+ and the project's dependencies must already be installed.

For terminal startup, run `npm start` inside `trading-journal`. For development with live updates, use `npm run dev` instead and leave that terminal open.

See [the application README](trading-journal/README.md) for first-time setup, features, and tests.
