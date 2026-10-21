# שרת MCP לקריאה בלבד — תכנית מימוש

תאריך: 21.10.2026. סטטוס: תכנית; לא מומש קוד.

מטרה: Claude (web, iOS, Desktop, Code) ו־ChatGPT (web, iOS) קוראים את כל נתוני ProCount — תזונה, מים, יעדים, קטלוג מזונות, אימונים — בשיחה רגילה, ללא שום יכולת כתיבה.

## החלטות

- **שרת מרוחק**: Supabase Edge Function חדשה `mcp` באותו פרויקט (`ghttttnwebaozbadlonp`). אין אחסון חדש. Streamable HTTP, stateless (`McpServer` חדש לכל בקשה).
- **Auth**: Supabase Auth כשרת OAuth 2.1 (בטא) עם Dynamic Client Registration. ההתחברות היא אותו אימייל+סיסמה; מסך אישור ב־PWA בנתיב `/oauth/consent`.
- **ספריות** (Deno, `npm:` specifiers): `@modelcontextprotocol/server@^2.3.1`, `@supabase/server@1`, `@supabase/middleware@1`, `zod@^4.3.6`. זה הדפוס של המדריך הרשמי: https://supabase.com/docs/guides/getting-started/byo-mcp
- **קריאה בלבד — 4 שכבות**:
  1. הקוד משתמש רק ב־`.select()` וב־`.rpc(fn, args, { get: true })` ⇒ PostgREST מריץ GET/HEAD בטרנזקציית `READ ONLY` — כתיבה נכשלת ב־Postgres.
  2. RLS — כל בקשה רצה עם ה־JWT של המשתמש (`withSupabase({ auth: "user" })`).
  3. מיגרציה: policies מסוג `restrictive` שחוסמות insert/update/delete לכל JWT שיש בו `client_id` (טוקן שהונפק ל־Claude/ChatGPT). הטוקן עצמו לא יכול לכתוב גם מחוץ לשרת ה־MCP. ה־PWA לא מושפע.
  4. `annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }` בכל כלי.
- **אזור זמן**: קבוע `Asia/Jerusalem` בשרת (Edge רץ ב־UTC). כל כלי מקבל תאריכים מפורשים `YYYY-MM-DD`; `get_profile` מחזיר את `today`.
- **שימוש חוזר בלוגיקה**: ייבוא ישיר של `src/lib/nutrition.js`, `date.js`, `workout.js` (ESM טהור). אין שכפול חישובים.
- **בחוץ**: כלי SQL חופשי, resources/prompts, cache, כתיבה מכל סוג.

## כלים

| כלי | קלט | מקור | פלט |
|---|---|---|---|
| `get_profile` | — | `profile` | `name`, `protein_goal_g`, `water_goal_ml`, `calorie_goal` (`CALORIE_GOAL`), `workout_goal_weekly`, `today`, `timezone` |
| `get_nutrition` | `from`, `to` (≤ 92 יום), `include_entries` (ברירת מחדל false; מותר רק ≤ 31 יום) | `entries` + `profile` | `days[]`: `date`, `protein_g`, `calories`, `water_ml`, `protein_goal_met`, ואופציונלית `meals[]` (`entriesByMeal`). `summary`: ממוצע חלבון/מים, `avgCaloriesPerActiveDay`, `days_goal_met`, `streak_ending_to` |
| `list_foods` | `query?` | `foods` | `id`, `name`, `unit`, `protein_g`, `calories`, `default_qty`, `protein_per_100g` |
| `list_exercises` | `include_archived?` | `training_exercises` | ספריית תרגילים |
| `get_workout_plan` | — | `workout_templates` + embedded `workout_template_exercises` + `training_exercises` | אימונים פעילים, תרגילים לפי סדר, `target_sets`, מנוחה, הערות |
| `list_workout_sessions` | `from`, `to` (≤ 92 יום), `status?` (ברירת מחדל `completed`) | `workout_sessions` + embedded exercises + sets | סשנים מלאים + `workoutVolume` לכל תרגיל |
| `get_exercise_progress` | `exercise_id`, `from`, `to`, `template_id?` | RPC `workout_progress` (GET, עם דפדוף) | `progressPoints(rows)` |

הערות:
- הגעה ל־`max_rows` של PostgREST (1000): `entries` ו־`workout_progress` נקראים דרך helper דפדוף `readAll`, כמו `loadProgress` ב־`store.js`.
- `list_workout_sessions` משתמש ב־embedding (`select("*, workout_session_exercises(*, workout_sets(*))")`) — בקשה אחת, בלי `.in()` עם מאות UUID ב־URL.
- היעד ההיסטורי לא נשמר; `protein_goal_met` מחושב מול היעד הנוכחי. לציין זאת ב־description של הכלי.
- קלט לא תקין (טווח הפוך/ארוך מדי) ⇒ `isError: true` עם הודעה ברורה, לא exception.

## קבצים

| קובץ | שינוי |
|---|---|
| `supabase/migrations/<ts>_oauth_clients_read_only.sql` | חדש — policies restrictive |
| `supabase/config.toml` | `[auth.oauth_server]` + `[functions.mcp] verify_jwt = false` |
| `supabase/functions/mcp/index.ts` | חדש — pipeline, רישום כלים |
| `supabase/functions/mcp/queries.ts` | חדש — שאילתות + עיצוב פלט + ולידציית טווח |
| `supabase/functions/mcp/queries.test.ts` | חדש — Deno tests לפונקציות הטהורות |
| `src/OAuthConsent.jsx` | חדש — מסך אישור בעברית |
| `src/Root.jsx` | הסתעפות ל־`/oauth/consent` |
| `vercel.json` | rewrite ל־SPA (רק אם ה־PWA על Vercel וה־deep link מחזיר 404) |
| `CLAUDE.md`, `AGENTS.md`, `supabase/README.md` | תיעוד: הפונקציה השנייה, OAuthConsent כקובץ auth שלישי שמותר לו לקרוא ל־Supabase, ה־policy |

ענף: `feature/mcp-read-only` מ־`master`.

---

## שלב 0 — בדיקות מקדימות (לפני קוד)

כל סעיף חוסם; תוצאה שלילית משנה את התכנית.

**תוצאות (21.10.2026):**
- 0.1 ChatGPT — **פתוח**, דורש בדיקה בחשבון של המשתמש.
- 0.2 JWT — **עבר**. ES256 `in_use` מאז 17.06.2026, ‏HS256 `previously_used`; ה־PWA משתמש ב־publishable key. לא צריך לסובב מפתח, ו־`analyze-food-photo` כבר עובדת כך.
- 0.3 Site URL — `https://pro-count-rho.vercel.app` (ה־allow list: `/**`). ‏`/oauth/consent` מחזיר **404** ⇒ `vercel.json` עם rewrite ל־SPA **נדרש** (בשלב 2).
- 0.4 ייבוא `src/lib` — **עבר**. פריסה עם `--use-api` העלתה את `nutrition.js`, `workout.js`, `date.js` והפונקציה החזירה תוצאה נכונה. פונקציית הניסיון נמחקה. לפרוס תמיד עם `--use-api` (Docker לא נדרש). Deno לא מותקן מקומית — נדרש לבדיקות `deno test`.
- 0.5 הרשמות — **בוצע**: `disable_signup: true` דרך Management API (`/auth/v1/settings` מאשר).
- OAuth server כרגע כבוי (`oauth_server_enabled: false`, DCR כבוי) — יופעל בשלב 2.
- **אזהרה לשלב 2**: `config.toml` אינו מכיל סעיף `[auth]`. ‏`supabase config push` עלול לדרוס את `site_url`, `disable_signup` ואת `mailer_autoconfirm` בערכי ברירת המחדל. להפעיל את ה־OAuth server דרך `PATCH /v1/projects/{ref}/config/auth` (`oauth_server_enabled`, `oauth_server_allow_dynamic_registration`, `oauth_server_authorization_path`), ולא דרך `config push`.

1. **ChatGPT**: ב־chatgpt.com/plugins (או Settings → Apps/Connectors) לוודא שהחשבון יכול להוסיף "custom MCP server". מקורות סותרים לגבי Plus/Pro. אם לא — Claude בלבד, שאר התכנית זהה.
2. **מפתח חתימת JWT**: Dashboard → Settings → JWT Keys. אם הפרויקט עדיין על HS256 legacy:
   - ליצור מפתח ES256 ולסובב אליו. ה־legacy secret נשאר כ־"previous key" לאימות, כך שסשנים קיימים ו־anon key לא נשברים.
   - לבדוק מיד את `analyze-food-photo` (היא `verify_jwt = true`): צילום + השלמה ידנית מה־PWA. אם השער דוחה טוקנים חדשים — להעביר אותה ל־`verify_jwt = false`. היא כבר יוצרת client עם ה־Authorization header, ו־`consume_ai_call` נכשל בלי `auth.uid()`; לוודא שמוחזר 401 ולא 500 לבקשה בלי טוקן.
3. **Site URL**: Authentication → URL Configuration. לוודא שהוא הדומיין של ה־PWA בפרודקשן, ולבדוק ש־`https://<site>/oauth/consent` מגיש את `index.html` (לא 404).
4. **ייבוא `src/lib` מתוך Edge Function**: פונקציית ניסיון שמייבאת `../../../src/lib/nutrition.js`, ואז `supabase functions deploy` (לא רק `serve`). אם הבנדלר לא כולל קבצים מחוץ ל־`supabase/functions` — להעביר את `date.js`, `nutrition.js`, `workout.js` ל־`supabase/functions/_shared/` ולייבא משם גם ב־`src/` (Vite מייבא נתיב יחסי בלי בעיה). העברה, לא העתקה.
5. **הרשמות**: `Login.jsx` מאפשר `signUp`, ו־`foods` משותף לכל משתמש מחובר. מומלץ לכבות "Allow new users to sign up" — שרת OAuth ציבורי הופך את זה לרלוונטי יותר. (שינוי הגדרה, לא קוד.)

## שלב 1 — מיגרציה: טוקני OAuth לקריאה בלבד

`supabase/migrations/<ts>_oauth_clients_read_only.sql`:

```sql
-- Tokens issued by the Supabase OAuth server (MCP clients) carry a client_id claim.
-- Restrictive policies AND with the existing "own rows"/"shared foods" policies, so
-- such tokens can read but never write — even if used directly against PostgREST.
-- First-party PWA sessions have no client_id and are unaffected.
do $$
declare t text;
begin
  foreach t in array array['entries','foods','profile','training_exercises','workout_templates',
    'workout_template_exercises','workout_sessions','workout_session_exercises','workout_sets']
  loop
    execute format('create policy "oauth clients cannot insert" on public.%I as restrictive for insert to authenticated with check ((select auth.jwt() ->> ''client_id'') is null)', t);
    execute format('create policy "oauth clients cannot update" on public.%I as restrictive for update to authenticated using ((select auth.jwt() ->> ''client_id'') is null)', t);
    execute format('create policy "oauth clients cannot delete" on public.%I as restrictive for delete to authenticated using ((select auth.jwt() ->> ''client_id'') is null)', t);
  end loop;
end $$;
```

לפני החלה: לפענח טוקן OAuth אמיתי (אחרי שלב 3) ולוודא ששם ה־claim הוא בדיוק `client_id`, ושטוקן סשן רגיל של ה־PWA *לא* מכיל אותו. עד אז — לכתוב את המיגרציה, לא להחיל.

אימות:
- PWA: הוספה, עריכה, מחיקה ו־undo של מזון ומים; שמירת יעד; התחלת אימון ושמירת סט — הכול עובד.
- `npm test` ירוק.

## שלב 2 — מסך אישור ב־PWA

**הגדרות** (`supabase/config.toml` + Dashboard, ואז `supabase config push`):

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = true

[functions.mcp]
verify_jwt = false
```

**`src/Root.jsx`** — הסתעפות לפני `App`:

```jsx
if (!session) return <Login />;
if (location.pathname === "/oauth/consent") return <OAuthConsent />;
return <App session={session} />;
```

`Login` כבר מחזיר ל־Root אחרי התחברות, וה־URL (כולל `authorization_id`) לא משתנה — אין צורך ב־redirect נוסף.

**`src/OAuthConsent.jsx`** — inline styles, RTL, Heebo, dark:
- `authorization_id` מ־`location.search`; חסר ⇒ הודעת שגיאה.
- `supabase.auth.oauth.getAuthorizationDetails(id)` (קיים ב־supabase-js 2.108.2 המותקנת):
  - `"authorization_id" in data` ⇒ להציג: שם הלקוח (`data.client.name`), דומיין ה־`redirect_uri`, האימייל של המשתמש, ושורה קבועה: "גישת קריאה בלבד לנתוני התזונה, המים והאימונים שלך".
  - אחרת ⇒ `location.href = data.redirect_url` (כבר אושר בעבר).
- כפתורים "אישור" / "דחייה" ⇒ `approveAuthorization(id)` / `denyAuthorization(id)` (ברירת המחדל מבצעת redirect). כפתורים נעולים בזמן בקשה (`src/lib/submission.js`).
- שגיאה ⇒ הודעה בעברית + כפתור חזרה ל־`/`.

אימות: `npm run build`; ידנית בשלב 3 (צריך בקשת OAuth אמיתית כדי לקבל `authorization_id`).

## שלב 3 — שלד ה־Edge Function + `get_profile`

`supabase/functions/mcp/index.ts`:

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.3.1";
import { pipeline } from "npm:@supabase/middleware@1";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1";
import { z } from "npm:zod@^4.3.6";
import * as q from "./queries.ts";

// ponytail: every tool is a read. Reads go through .select()/.rpc(..., { get: true }),
// so PostgREST runs them in READ ONLY transactions; the oauth_clients_read_only
// migration blocks writes for MCP-issued tokens at the RLS layer too.
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

Deno.serve(pipeline(
  [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
  (req, { supabase }) => createMcpHandler(() => {
    const server = new McpServer({ name: "procount", version: "1.0.0" });
    const tool = (name, description, inputSchema, run) =>
      server.registerTool(name, { description, inputSchema, annotations: READ_ONLY }, async (args) => {
        try {
          return { content: [{ type: "text", text: JSON.stringify(await run(args)) }] };
        } catch (e) {
          return { isError: true, content: [{ type: "text", text: e.message }] };
        }
      });
    tool("get_profile", "...", z.object({}), () => q.getProfile(supabase));
    // remaining tools in stage 4
    return server;
  }).fetch(req),
));
```

`queries.ts` — בסיס:

```ts
export const TZ = "Asia/Jerusalem"; // ponytail: single user; move to profile if that changes
export const todayIn = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD

export async function readAll(build) {
  const rows = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build().range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
```

- `getProfile` — `profile` עשוי לא להתקיים (אין signup trigger) ⇒ ברירות מחדל 160 / 3000 / 3, כמו ב־`store.js`.
- `streak(byDay, goal, from)` מצפה ל־`Date` מקומי — להעביר `new Date(\`${to}T12:00:00\`)`. ב־Deno (UTC) התאריך המקומי שווה ל־UTC, ולכן `isoLocal` מחזיר את `to`.

פריסה ובדיקה מקצה לקצה:

```bash
supabase functions deploy mcp
```

```bash
claude mcp add --transport http procount https://ghttttnwebaozbadlonp.supabase.co/functions/v1/mcp
```

- `curl` בלי טוקן ⇒ `401` עם `WWW-Authenticate: ... resource_metadata=".../oauth-protected-resource"`.
- ב־Claude Code: `/mcp` → אימות → דפדפן → Login → מסך האישור → אישור → `get_profile` מחזיר נתונים.
- עכשיו לפענח את ה־access token (jwt.io או `atob` על החלק האמצעי), לאשר את `client_id`, ולהחיל את מיגרציית שלב 1 (`apply_migration` דרך Supabase MCP, או `supabase db push`).

## שלב 4 — שאר הכלים

ב־`queries.ts`, פונקציה לכל כלי שמקבלת `(supabase, args)`. חלוקה פנימית:
- `assertRange(from, to, maxDays)` — טהורה: פורמט, `from <= to`, ואורך. נזרקת ⇒ `isError`.
- `shapeNutrition(entries, profile, from, to, includeEntries)` — טהורה. משתמשת ב־`dailyTotals`, `dailyWaterTotal`, `entriesByMeal`, `proteinByDay`, `streak`, `avgCaloriesPerActiveDay`, ובלולאת `shiftDate` מ־`from` עד `to`.
- `shapeSessions(rows)` — טהורה. ממיינת תרגילים וסטים לפי `position`, ומוסיפה `workoutVolume`.
- `get_exercise_progress` ⇒ `readAll(() => supabase.rpc("workout_progress", {...}, { get: true }))` ⇒ `progressPoints`.

Descriptions של הכלים באנגלית, קצרים, ומציינים: יחידות (g, kcal, ml, kg), שהתאריכים הם לפי שעון ישראל, שה־goal הוא הנוכחי, ושה־id מגיע מ־`list_exercises` או `get_workout_plan`.

`queries.test.ts` (Deno) — בדיקה אחת לכל פונקציה טהורה:
- טווח הפוך או ארוך מדי נדחה.
- `shapeNutrition`: מים לא נספרים כחלבון; יום ריק מופיע עם 0; `include_entries` מעל 31 יום נדחה; `streak_ending_to` נכון.
- `shapeSessions`: הסדר נשמר.

```bash
deno test supabase/functions/mcp/
```

## שלב 5 — חיבור לקליינטים ובדיקת אבטחה

1. **claude.ai (web)**: Customize → Connectors → Add custom connector → ה־URL → Sign in. בשיחה: "כמה חלבון אכלתי השבוע לעומת היעד?", "מה ההתקדמות שלי בלחיצת חזה ב־3 חודשים?".
2. **Claude iOS**: הקונקטור שנוסף ב־web זמין באפליקציה — לבדוק שאלה אחת.
3. **ChatGPT** (אם שלב 0.1 עבר): chatgpt.com/plugins → "+" → Add custom MCP server → OAuth (DCR) → אותן שאלות, ב־web וב־iOS.
4. **בדיקות אבטחה** — עם access token של הקונקטור (מלוגי Claude Code או מבדיקת שלב 3):
   - `POST /rest/v1/entries` ישירות ל־PostgREST ⇒ חייב להיכשל ב־RLS (`42501`).
   - `PATCH /rest/v1/profile` ⇒ 0 שורות או שגיאה.
   - `POST /rest/v1/rpc/save_workout_set` ⇒ חייב להיכשל.
   - `PUT /auth/v1/user` (שינוי סיסמה) ⇒ לתעד את התוצאה. אם מצליח — זהו סיכון שארית של OAuth server בבטא; לפתוח issue מול Supabase ולשקול כיבוי הקונקטור עד תיקון.
   - בקשה ל־MCP עם טוקן של משתמש אחר (אם קיים) ⇒ לא רואה את הנתונים שלך.
5. **ניהול גישה**: Dashboard → Authentication → OAuth Apps — לוודא ששני הלקוחות רשומים; ביטול גישה = מחיקת הלקוח או ה־grant.

## שלב 6 — תיעוד ו־PR

- `CLAUDE.md` + `AGENTS.md` (יחד): סעיף "MCP server": הפונקציה, 4 שכבות הקריאה בלבד, ו־`OAuthConsent.jsx` כקובץ UI נוסף שמותר לו לקרוא ל־Supabase לצורכי auth.
- `supabase/README.md`: layout, deploy, הגדרות OAuth server, חיבור קונקטורים.
- PR ל־`master`.

## סיכונים

| סיכון | השפעה | מענה |
|---|---|---|
| OAuth server של Supabase בבטא | שבירה בעדכון של Supabase | הקונקטור הוא תוספת; ה־PWA לא תלוי בו |
| סיבוב מפתח JWT | `analyze-food-photo` או סשנים קיימים נשברים | שלב 0.2 עם בדיקה מיידית; legacy נשאר כ־previous key |
| ChatGPT Plus/Pro לא תומך ב־custom MCP | ChatGPT לא זמין | Claude בלבד; לבדוק בשלב 0.1 לפני שמשקיעים |
| טוקן OAuth ניגש ל־Auth API | שינוי סיסמה או אימייל ע״י מחזיק הטוקן | בדיקה בשלב 5.4 |
| `src/lib` לא נבנה בבנדלר | build נכשל | שלב 0.4 — העברה ל־`_shared` |
| קלט נתונים כ־prompt injection (שמות מזון) | המודל "מציית" לטקסט בנתונים | אין כלי כתיבה, ולכן ההשפעה מוגבלת לתשובה עצמה |
