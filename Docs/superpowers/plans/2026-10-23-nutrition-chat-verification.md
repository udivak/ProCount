# Nutrition chat verification — 23 October 2026

Implemented from origin/master 5efdcfb on feature/nutrition-chat. No migration,
auth/MCP permission change, production deployment, merge, or live diary write.
The model migration is isolated in 606cca2 for rollback.

## Automated checks

- npm test: 81 passed, 0 failed (app helpers plus existing MCP tests).
- Deno Edge Function tests: 25 passed, 0 failed, including legacy manual/photo.
- Deno typecheck of analyze-food-photo/index.ts: passed.
- npm run build and git diff --check: passed. Vite reports its standard >500 kB
  chunk warning; this change adds no dependencies or bundle splitting.
- Shared draft validation rejects forged IDs, non-finite/negative nutrition,
  duplicate keys, invalid dates, and excessive items. Server rejects system roles,
  stale today/timezone, excessive history/images/body, and failed context reads.
- Mock quota denies inference at the 30/day boundary without real quota use.

## Live OpenAI samples (synthetic data only)

All calls used the actual request builder/handler with synthetic auth/context and
mock quota; the outbound OpenAI request used the existing project key. No Supabase
write or user diary data was involved. All returned HTTP 200, model gpt-6.1-sol,
status completed, no incomplete result. The configured effort was medium and
store was false. This proves key/model availability, not deployed JWT/RLS behavior.

| Sample | Time | Input/output tokens | Result |
|---|---:|---:|---|
| Manual: two eggs, one egg unit, total 100g | 6.54s | 290 / 123 | Per-egg 78 kcal and 6.3g protein; not doubled |
| Synthetic image: two eggs without oil | 3.27s | 734 / 66 | Whole-plate estimate, editable assumptions |
| Chat: 2L today, existing 1L | 3.80s | 839 / 63 | Asked total versus additional water |
| Follow-up: 2L total today | 4.52s | 874 / 151 | Proposed exactly 1L additional on actual today |
| Four images of the same shared plate | 3.52s | 2292 / 61 | Asked personal portion; did not multiply plates |

The two conversation-follow-up samples used assistant/user history, exercising the
Responses content format as well as the draft schema. Repeated text/photo samples
also completed. Estimates are not measurements or proof of nutrition accuracy.

## Browser acceptance

Actual App + useData + NutritionChat tested in the in-app browser at 390x844 using
an ephemeral, synthetic-only harness. All database and AI operations were local
stubs; the harness was removed after verification.

- AddSheet entry opens chat; edited quantity shows no-recalculation warning.
- Image chooser/compression/preview; no writes before explicit approval.
- Mixed dates and food/water totals; journal reflects approved manual nutrition.
- Failure after 2 of 4 saves: showed 2/4; same-ID retry reached 4/4 with 4 rows.
- Timeout after commit: lookup recovered each UUID and journal/totals updated.
- External device added a row: preflight stopped with 0 writes, displayed current
  context, and required another approval before inserting.
- Delayed response after editing: old draft was discarded; subsequent request
  used the correction. Double-click approval did not duplicate entries.
- First chat inherits AddSheet date; established conversation survives closing.
- Focus starts inside chat and returns to the persistent add button on close.
- Hebrew RTL/mobile date and numeric controls checked; browser error log empty.

## Independent review and fixes

One fresh reviewer inspected the whole branch. No Critical or Minor findings;
four Important findings were fixed in one pass:

1. Recovered server rows were missing from journal state: added verified-row
   application under refreshGuard, reproduced failure then passed helper regression
   and actual browser timeout-after-commit journal readback.
2. PostgREST may cap results at 1,000 despite limit(1001): exact counts plus returned
   length checks now detect truncation. Capped-response test failed then passed.
3. First chat used app-launch date: untouched chat now initializes from AddSheet
   date. Browser reproduced yesterday/today mismatch then confirmed yesterday.
4. AddSheet focus restoration stole chat focus: dedicated transition/return focus.
   Browser reproduced focus on FAB then confirmed chat-close focus and return.

Rulings: followed the explicit repository master-base rule, with no worktree;
reused shared JS validation in the Edge Function; used npm-cached Deno with
--node-modules-dir=none because Deno was not globally installed. No app dependency
was added. Exact counts replace the plan's limit+1-only approach because server
row caps otherwise silently truncate context. No other scope change.

## Remaining release checks and limits

Physical iPhone PWA keyboard/safe-area behavior and deployed end-to-end JWT/RLS
writes remain unverified. Deploy compatible Edge Function first with --use-api,
verify it, then frontend, only after release approval. Never supabase config push.
Full refresh during saving loses in-memory attempt IDs: inspect the journal before
starting over. Context preflight cannot prevent a semantic duplicate written on
another device immediately after that read. These limitations are shown/documented.
