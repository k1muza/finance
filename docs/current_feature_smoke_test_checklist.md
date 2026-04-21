# Current Feature Smoke Test Checklist

This guide is a quick way to verify the main features that exist in the app today.

Estimated time: 10 to 15 minutes

Recommended role: district `admin`, `secretary`, or `treasurer`

## Before You Start

- Sign in to the app.
- Make sure you have access to a district.
- If you are a superuser, select one district context before testing district-scoped pages.

## 1. District Setup

- Open `/dashboard/setup` if you do not already have a district.
- Create a district.
- Confirm you land in the dashboard and the district becomes selectable in the app context.

Expected result:
- The district is created successfully.
- You can open `/dashboard/overview` without setup errors.

## 2. Overview

- Open `/dashboard/overview`.
- Confirm the page loads the current district summary.
- Confirm quick links exist for `Cashbook`, `Transfers`, `Reports`, and `Settings`.

Expected result:
- Overview loads without errors.
- Quick links navigate to working pages.

## 3. Accounts

- Open `/dashboard/settings`.
- In the accounts section, create two active accounts in the same currency.
- Example:
  - `Main Cash`, type `cash`, currency `USD`
  - `Main Bank`, type `bank`, currency `USD`
- Add an opening balance to one account.
- Edit one account field such as description or sort order.

Expected result:
- Both accounts save successfully.
- Opening balance appears under the selected account.
- Edited values persist after refresh.

## 4. Funds

- In `/dashboard/settings`, create at least two funds.
- Example:
  - `General Fund`, nature `mixed`
  - `Tithes`, nature `income_only`, `requires_individual_source = true`
- Edit one fund after saving it.

Expected result:
- Funds save and remain visible after refresh.
- Fund nature and individual-source requirement persist.

## 5. Members

- Open `/dashboard/finance/members`.
- Create one region.
- Create one assembly under that region.
- Create one individual under that assembly.

Suggested sample data:
- Region: `North Region`
- Assembly: `Central Assembly`
- Individual: `John Example`

Expected result:
- Region, assembly, and individual all save successfully.
- Parent-child relationships display correctly in their tabs.

## 6. Cashbook Drafts and Workflow

- Open `/dashboard/finance/cashbook`.
- Create a draft `receipt` into one account using:
  - fund `Tithes`
  - source `John Example`
  - amount `100`
- Create a draft `payment` from the same account using:
  - fund `General Fund`
  - amount `25`
  - either a source/payee or fallback counterparty
- Create a draft `adjustment` and test one direction.
- If your role allows it, move one draft through:
  - `Submit`
  - `Approve`
  - `Post`
- Open the transaction detail panel and confirm the audit trail is visible.

Expected result:
- Drafts save successfully.
- Tithe-style receipts accept the individual source.
- Workflow actions appear only when your role permits them.
- A posted transaction receives a reference number.

## 7. Reversal

- From the cashbook page, pick one posted non-transfer transaction.
- Reverse it.
- Confirm the original transaction is no longer editable as a normal posted row.
- Confirm the reversal row is linked and visible in the cashbook/detail flow.

Expected result:
- Reversal succeeds once.
- The original and reversal remain traceable.

## 8. Transfers

- Open `/dashboard/finance/transfers`.
- Create a draft transfer from `Main Cash` to `Main Bank`.
- Use an amount such as `40`.
- Save the draft.
- Post the transfer if your role allows it.
- Open transfer detail and confirm both sides are represented.
- Reverse the transfer if your role allows it.

Expected result:
- Draft transfer saves successfully.
- Posting succeeds only when accounts differ and share the same currency.
- Account cashbooks reflect the transfer effects.
- Reversal works once and preserves traceability.

## 9. Reports

- Open `/dashboard/finance/reports`.
- Switch through the tabs:
  - `Cashbook`
  - `Fund Summary`
  - `Budget vs. Actuals`
- Change the period preset at least once.
- Export CSV.

Expected result:
- Cashbook totals reflect posted operational activity.
- Fund Summary excludes transfers from fund totals.
- Budget vs. Actuals loads without errors.
- CSV export downloads successfully.

## 10. Final Sanity Checks

- Return to `/dashboard/overview`.
- Confirm totals changed after the posted cashbook activity.
- Open `/dashboard/finance/accounts` and confirm balances reflect opening balances plus posted effects.
- Open `/dashboard/finance/funds` and confirm fund totals reflect receipts and payments, not transfers.

Expected result:
- Overview, account balances, and fund totals remain internally consistent.

## Known Limits While Testing

- Offline banners and persisted UI state exist, but the full offline write queue is not implemented yet.
- Budgets are still the current flat model, not the later header-and-lines redesign.
- Attachments and the later advanced export/reporting backlog items are not part of the current feature set.

## Suggested Pass Criteria

Treat the smoke test as passing if all of the following are true:

- You can create and work inside a district.
- You can manage accounts, funds, opening balances, and members.
- You can create draft cashbook entries and move them through the workflow.
- You can reverse a posted non-transfer transaction.
- You can create, post, and reverse a transfer.
- Reports load and CSV export works.
