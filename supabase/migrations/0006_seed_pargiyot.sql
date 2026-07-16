-- 0006: seed the shared foods catalog with פרגיות (boneless, skinless chicken thigh).
-- Same cut as the existing "ירך עוף צלוי (ללא עור)"; macros are per 100 g, grilled,
-- matching the catalog's "100 גרם" unit convention. Idempotent on name so a re-run
-- (or a db push against a DB that already has the row) is a no-op.

insert into foods (name, unit, protein_g, calories, default_qty)
select 'פרגיות צלויות', '100 גרם', 27, 209, 1
where not exists (select 1 from foods where name = 'פרגיות צלויות');
