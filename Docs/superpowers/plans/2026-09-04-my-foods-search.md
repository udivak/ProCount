# My Foods Search Implementation Plan

**Goal:** לאפשר חיפוש מקומי לפי שם מעל רשימת "מאכלים שלי" כדי לזהות מאכל קיים לפני הוספה.

**Architecture:** `searchFoods` ישתמש ב־`normalizeFoodText` הקיים כדי להשוות שם מאכל ושאילתה באופן עקבי עם מניעת הכפילויות. `MyFoods` יחזיק רק את ערך החיפוש ויציג את תוצאות הסינון, מונה ומצב ריק.

**Tech Stack:** React, JavaScript, בדיקות `node --test`; ללא שינוי Supabase או תלויות.

## Task 1: סינון ותצוגה

**Files:**

- Modify: `src/lib/write.js`
- Modify: `src/lib/write.test.js`
- Modify: `src/screens/MyFoods.jsx`

- [x] להוסיף `searchFoods(foods, query)` שמחזירה את כל הרשימה לשאילתה ריקה, או מאכלים ששמם המנורמל מכיל את השאילתה המנורמלת.
- [x] להוסיף בדיקת Node שמכסה חיפוש עם רווחים/תווי כיווניות ושאילתה ריקה.
- [x] להוסיף ל־`MyFoods` שדה `type="search"` מעל הרשימה, מונה תוצאות ומצב "לא נמצאו מאכלים תואמים"; כפתור "מאכל חדש" נשאר זמין.
- [x] להריץ `node --test src/lib/write.test.js`, `npm test`, `npm run build` ו־`git diff --check`.
- [x] לבצע קומיט אטומי: `feat: add saved food search`.
