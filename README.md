# 🧈 Butter Split (奶油分帳)

**English** | [繁體中文](README.zh-TW.md)

**A multi-currency group expense splitter that turns a messy pile of shared receipts into the shortest possible list of "who pays whom."**

🔗 **Live demo:** https://christychenn.github.io/split-bill/?demo  
*(demo mode: fictional sample data, nothing is saved to the cloud)*
🌐 Interface language: Traditional Chinese

---

## The problem

When friends travel or eat together, one person usually pays for dinner, another covers the taxi, a third books the hotel — often in different currencies. By the end of a trip, figuring out who owes whom becomes a tangle of spreadsheets, screenshots, and mental math, and the naive answer ("everyone pays everyone back for every item") produces far more bank transfers than necessary.

Butter Split solves this in three steps:

1. **Record** each expense: who paid, how much, in which currency, and who shared it.
2. **Convert** everything into one base currency using a shared exchange-rate table.
3. **Settle** with a simplified repayment plan that collapses all those debts into as few transfers as possible.

## Why I built it

My background is in accounting — I studied Accountancy, worked in financial-statement audit, and now work as an SAP Controlling (CO) consultant. Splitting a group bill turns out to be a small version of problems I deal with professionally:

| Group trip | Corporate accounting |
|---|---|
| Expenses paid in JPY, KRW, USD… | Transactions in multiple currencies |
| Convert everything to one base currency | Translation into a company's functional currency |
| Net each person's balance before paying | Intercompany netting before cash settlement |
| "Closed" trip, read-only records | Period-end close and locked ledgers |
| Mark repayments as settled | Clearing open items |

I built Butter Split to practice turning that domain knowledge into working software on my own — designing the data model, writing the settlement logic, and deploying a real, shareable product rather than only configuring systems someone else built.

## Features

- 🗂️ **Multiple plans** — keep each trip or event as its own independent ledger
- 🐻 **Flexible members** — add people to a plan at any time
- 💸 **12 currencies** — TWD, JPY, KRW, USD, EUR, CNY, HKD, SGD, THB, VND, GBP, AUD, each converted into the plan's base currency
- 💱 **Shared exchange-rate table** — enter rates manually or fetch live rates with one click
- ⚖️ **Equal or custom splits** — custom amounts are validated so they must add up to the total
- 🔁 **Simplified settlement** — computes a short list of repayments instead of one transfer per expense
- ✅ **Settlement tracking** — mark a repayment as paid (and undo it); balances update immediately
- 🔒 **Close a plan** — once a trip is finished, its records become read-only
- 🔗 **Real-time sharing** — send a link; friends open it and see the same plan, synced through Google Sheets, with no sign-up or setup

## How the settlement works

1. **Net balances.** For every member, the app adds what they paid and subtracts their share of every expense (all in the base currency). Repayments already marked as settled are applied too. A positive balance means "should receive"; a negative one means "owes."
2. **Greedy matching.** Members are split into debtors and creditors and sorted by amount. The largest debtor pays the largest creditor as much as possible; whoever reaches zero drops out, and the process repeats.
3. **Rounding control.** Amounts are rounded to cents, and residuals under 0.005 are treated as zero so floating-point noise doesn't produce meaningless micro-transfers.

This is the same debt-simplification idea popularized by apps like Splitwise. For a group of *n* people it never needs more than *n − 1* transfers, regardless of how many expenses were recorded.

**Example (from the demo):** four friends record 7 shared expenses in Tokyo, paid by different people, in JPY and TWD, some split equally and some by custom amounts. Butter Split reduces everything to just 3 transfers.

## Architecture

```
┌──────────────────────────┐        HTTPS (GET / POST, JSON)       ┌──────────────────────────┐
│  index.html              │  ───────────────────────────────────▶ │  Google Apps Script      │
│  Vanilla HTML/CSS/JS     │                                        │  (Code.gs, web app)      │
│  • UI & settlement logic │  ◀─────────────────────────────────── │  • list / get / save /   │
│  • localStorage cache    │        polling every 4–6 seconds       │    delete plans, rates   │
└────────────┬─────────────┘                                        └────────────┬─────────────┘
             │ hosted on                                                         │ stores in
             ▼                                                                   ▼
     GitHub Pages (auto-deployed                                       Google Sheets
     by GitHub Actions on push)                                        (`plans` and `rates` tabs)
```

- **Frontend:** a single `index.html` with no frameworks, build step, or dependencies.
- **Backend:** a lightweight Google Apps Script web app (`google-apps-script/Code.gs`) that exposes a small JSON API and uses a Google Sheet as its database.
- **Access control:** the backend URL is never committed; it reaches each browser through the share link, and every request must carry an access key stored in Apps Script's Script Properties.
- **Sync:** changes are saved locally first, then pushed to the cloud (debounced). Each client polls for newer versions using `updatedAt` timestamps, and skips re-rendering while the user is typing so edits aren't interrupted.
- **Offline fallback:** if the cloud can't be reached, the app keeps working from browser storage.
- **Exchange rates:** live rates come from the free [open.er-api.com](https://open.er-api.com) API; the provider is isolated in one function so it can be swapped easily.
- **Deployment:** GitHub Actions publishes the site to GitHub Pages on every push to `main`.

## Running it yourself

**Quick start (local only):** download the repository and open `index.html` in a browser. Data is stored in your browser's `localStorage`.

**With cloud sync:**

1. Create a new Google Sheet and open **Extensions → Apps Script**.
2. Paste in `google-apps-script/Code.gs` and deploy it as a **Web app** (execute as: me; access: anyone).
3. In **Project Settings → Script Properties**, add `ACCESS_KEY` with a long random value.
4. Open the site once with `#api=<web-app URL>&key=<ACCESS_KEY>` appended to the address. The browser remembers it; the URL and key are never committed to this repository.
5. Open a plan and click **🔗 分享 (Share)**: the generated link carries the connection, so friends need no setup.

## Repository structure

```
split-bill/
├── index.html                    # The entire app: UI, styles, settlement logic, sync client
├── google-apps-script/
│   └── Code.gs                   # Backend API on Google Apps Script + Google Sheets
└── .github/workflows/deploy.yml  # CI/CD: auto-deploy to GitHub Pages
```

## What I learned

- **Modeling money in code:** representing balances, conversions, and rounding carefully enough that the books always balance to zero.
- **Algorithm design:** turning an informal rule ("pay back the fewest times") into a concrete, testable procedure.
- **Building a backend without a server:** using Google Apps Script and Sheets as a free, zero-maintenance API and database.
- **Collaborative state:** keeping several people's views in sync with simple polling and timestamp-based conflict handling.
- **Shipping:** setting up continuous deployment so every change goes live automatically.
- **Security in public code:** my first version hard-coded the backend URL in this public repo, which meant anyone could read the data behind it. I revoked that deployment, moved the URL out of the code into the share link, added an access key checked on the server, and built a demo mode with fictional data for the public page. Lesson: anything that grants access to data is a credential, and a leaked credential must be rotated, not just deleted.

## Possible next steps

- English interface and language toggle
- Automated tests for the settlement and currency-conversion logic
- Exporting a plan's ledger to CSV/Excel
- Stronger conflict handling when two people edit the same plan at the same moment
