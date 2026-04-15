<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:finance-coding-rules -->
# Finance Coding Rules

**No hard delete for posted or approved cashbook records.**

Once a `cashbook_transaction` reaches `posted` status it is immutable. Corrections must go through reversal (create a new transaction with `kind = 'reversal'` and `source_transaction_id` pointing to the original, then post it). The database enforces this with a trigger; do not try to work around it. The same rule applies to `approved` records — step back to `submitted` through the workflow, do not delete.

Hard delete is only permitted on `draft` records that have never been submitted.
<!-- END:finance-coding-rules -->
