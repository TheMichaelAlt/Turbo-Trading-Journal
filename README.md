The Turbo Trading Journal is a lightweight desktop application to log and analyze your trades, as well as journal your daily summary and notes on each trade you take.

It is completely free, open source, and runs locally on your device for complete data privacy.

**[Download for Windows — latest release](https://github.com/TheMichaelAlt/Turbo-Trading-Journal/releases/latest)**

On the release page, expand **Assets** and download the file ending in `Setup.exe`. Run it, then open Turbo Trading Journal from your desktop shortcut or Start menu. Node.js and the source project are not required. The installer is unsigned, so Windows may show an unknown-publisher notice. Downloads become available once the first release is published.

For updates, save and close the app, then run the newer installer over your existing installation under the same Windows account. Your trades and journal pages stay in the same user-data folder. Updates are installed manually.

For local development, double-click **Start Turbo Journal.cmd** in this folder. It builds the latest edits and opens the desktop app without requiring a development server to stay running. Node.js 24+ and the project's dependencies must already be installed.

For terminal startup, run `npm start` inside `trading-journal`. For development with live updates, use `npm run dev` instead and leave that terminal open.

See [the application README](trading-journal/README.md) for first-time setup, features, and tests.
