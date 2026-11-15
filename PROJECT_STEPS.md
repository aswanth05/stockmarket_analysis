# US Stock Terminal: Complete Step-by-Step Plan

Read this with CLAUDE.md (technical rules) and UI_DESIGN.md (screen and visual rules). Finish each step before starting the next.

## Part A: Decide the scope

1. Confirm: US stocks on NYSE and Nasdaq only.
2. Confirm: research only in version 1. No trading.
3. Confirm: free data sources to start.
4. Confirm: Claude is the only AI model.
5. Confirm: private launch first. Do not publish publicly yet.

## Part B: Install the tools

6. Install Node.js (current LTS version).
7. Install Visual Studio with the Claude extension, or use Claude Code in a terminal.
8. Install Git.
9. Create a GitHub account to back up your code.
10. Install a password manager to store API keys.

## Part C: Create accounts and keys

11. Alpaca: sign up and create paper-trading API keys. Use these for market data and later for paper trading.
12. EODHD: sign up for the free plan (15 to 20 minute delayed quotes).
13. SEC EDGAR: no signup or key needed. Choose a contact name for the request header that you are comfortable sharing.
14. Anthropic API: sign up, add a payment method, and set a monthly spending limit.
15. Save every key in your password manager. Never paste keys into chat or commit them to Git.

## Part D: Set up the project folder

16. Create a folder named `us-stock-terminal`.
17. Place CLAUDE.md and UI_DESIGN.md in the folder's root.
18. Open the folder in Visual Studio.
19. Start Claude Code. Ask it to read CLAUDE.md and UI_DESIGN.md, propose a file structure, and wait for your approval.
20. Once approved, initialize Git and make the first commit.
21. Create PROGRESS.md. After each step, have Claude Code record what changed, what was tested, and what comes next.

## Part E: Design phase (before any code)

22. Make wireframes for: Login, Home, Stock Research, Stock Screener, and My Watchlist.
23. Define the design system: colors, type sizes, spacing, and the reusable components listed in UI_DESIGN.md.
24. Check contrast and review each wireframe at desktop and phone widths.
25. Approve the design before any frontend work starts.
26. Search for existing trademarks with the name "TradeVision" before using it publicly.

## Part F: Build, in order

For each build step, tell Claude Code: "Follow CLAUDE.md and UI_DESIGN.md. Do only this step. Explain your changes, run the tests, and stop for my review." Check the result before moving on.

27. **Scaffold.** Frontend and backend both start locally. Build the design-system components first.
    - Done when: both start with no errors and the component examples display.
28. **Login.** Sign-up, login, and logout, styled to the approved design. The terminal is hidden until login.
    - Done when: a logged-out visitor cannot reach any terminal screen.
29. **Market calendar and status pill.** Show open, closed, pre-market, or after-hours status in Eastern Time. Holidays come from stored data.
    - Done when: a weekend and a holiday both show closed.
30. **Home screen with placeholder data.** Build the four summary cards, index chart, sector donut, sentiment gauge, top-markets table, AI review box, price chart, weekly comparison, recent activity, and feature strip.
    - Done when: the layout matches the approved wireframe, with no crypto labels and no buy or sell wording.
31. **Data connection.** One service per provider, with keys kept on the server. Connect Alpaca paper data and EODHD delayed data.
    - Done when: an AAPL quote appears with its timestamp, its source, and a freshness badge.
32. **Quote storage and stale states.** Save each quote with its time. If a refresh fails, keep the last value and mark it stale.
    - Done when: turning off the connection shows the stale marker and the last time.
33. **Home screen on real data.** Replace placeholders with stored data and show the data time on every card and chart.
    - Done when: each Home card shows a data time and source.
34. **My Watchlist.** Add and remove companies, stored on the server for each account. Search narrows the list.
    - Done when: the list is still there after logging out and logging back in.
35. **Stock Research screen.** Company header, Long Term and Swing Trading tabs, financial charts, formulas on hover, factor scores, AI review panel, risks, and sources.
    - Done when: each number shows its formula, inputs, period, and source.
36. **Daily chart.** Candles, volume, and 50-day and 200-day moving averages from end-of-day history.
    - Done when: one day's prices match a public source.
37. **Index and ETF proxy panel.** SPY, DIA, and QQQ, labelled as ETF proxies.
    - Done when: the proxy labels are visible on screen.
38. **Top movers and sector panels.** Rank a stored S&P 500 list by daily change. Sector Analysis shows recent movement and business outlook as two separate areas.
    - Done when: rankings match the saved prices and the two areas are clearly separated.
39. **Stock Screener.** Filter panel on the left, results table on the right, and active filters shown above the results.
    - Done when: a filter's results match a manual check on two companies.
40. **EDGAR fundamentals and calculations.** Revenue, net income, and free cash flow from filings, with the period and filing ID shown. Growth, margin, return on equity, and free cash flow calculated in backend code.
    - Done when: one company's figures match its 10-K, and the tests pass for zero and negative values.
41. **Live updates.** Start with polling. Add a WebSocket only if polling is not enough.
    - Done when: prices update without a page reload, and the freshness badge updates too.
42. **AI review (optional).** Claude writes labelled explanations from stored evidence, with a monthly spending cap.
    - Done when: each review shows its date, its sources, and its status.
43. **Accessibility and phone review.** Keyboard navigation, screen-reader labels, reduced motion, contrast, and a narrow-width layout.
    - Done when: the checks pass and the phone layout matches the approved design.
44. **Private deployment.** Host the app, with keys stored in the host's secret settings.
    - Done when: the app loads from the private link and the keys are not visible in the browser.

## Part G: Rules to follow throughout

- Commit to Git after every step.
- Never show delayed data as live.
- Never fill missing data with zero or a guess.
- Never use buy, sell, or strong-buy wording in the app.
- Do not add broker integration until version 1 works.
- Do not publish stock picks publicly until a lawyer has reviewed them.
- Keep all keys on the server.
