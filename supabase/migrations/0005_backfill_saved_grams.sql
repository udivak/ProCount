-- 0005: backfill grams for existing quick-add ('saved') entries. Quick-add never stored
-- grams before 0004 — the gram count only lived in the food's free-text unit ("100 גרם").
-- Reconstruct servings from the protein ratio (entry.protein_g / food.protein_g) and
-- multiply by the grams-per-serving parsed out of the unit, so the detail modal can show
-- amount eaten + protein-per-100g for past entries too.
--
-- ponytail: only touches gram-denominated foods with protein_g > 0; anything else stays
-- null → "—" (grams genuinely unknown). The ratio assumes the food's protein_g hasn't been
-- edited since logging — fine for this single-user app; upgrade path is a real serving_g
-- column + storing qty on the entry if foods ever get re-macro'd after use.

update entries e
set grams = round(
      e.protein_g * (regexp_match(f.unit, '(\d+(?:\.\d+)?)\s*(?:גרם|גר|g)'))[1]::numeric / f.protein_g,
      1)
from foods f
where e.food_id = f.id
  and e.source = 'saved'
  and e.grams is null
  and f.protein_g > 0
  and f.unit ~ '(\d+(?:\.\d+)?)\s*(גרם|גר|g)';
