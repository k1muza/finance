-- ============================================================
-- Import April 2026 SCCI cashbook entries for Southgate District
--
-- Source workbook: C:\Users\k1muz\Downloads\SCCI Cashbook.xlsx
--
-- Idempotency:
-- - opening balance uses the account/date uniqueness constraint
-- - cashbook transactions use deterministic client_generated_id values
--   derived from the workbook row numbers and import tag
--
-- Date note:
-- Rows before the first explicit text date (13/4/2026) are stored in
-- the workbook as opaque numeric date values that do not round-trip
-- reliably outside Excel. To keep this migration deterministic, those
-- groups are mapped sequentially to 2026-04-04 through 2026-04-12,
-- matching the ledger order immediately before the explicit
-- 2026-04-13 rows.
-- ============================================================

DO $$
DECLARE
  v_import_tag     CONSTANT TEXT := 'scci-cashbook-april-2026';
  v_district_name  CONSTANT TEXT := 'Southgate District';
  v_account_name   CONSTANT TEXT := 'Cash';
  v_actor_user_id  UUID;
  v_district_id    UUID;
  v_account_id     UUID;
  v_general_fund_id UUID;
BEGIN
  SELECT up.id
  INTO v_actor_user_id
  FROM public.user_profiles AS up
  WHERE up.is_superuser = TRUE
  ORDER BY up.created_at NULLS LAST, up.id
  LIMIT 1;

  IF v_actor_user_id IS NULL THEN
    SELECT du.user_id
    INTO v_actor_user_id
    FROM public.district_users AS du
    JOIN public.districts AS d ON d.id = du.district_id
    WHERE lower(d.name) = lower(v_district_name)
      AND du.is_active = TRUE
    ORDER BY du.created_at NULLS LAST, du.id
    LIMIT 1;
  END IF;

  IF v_actor_user_id IS NULL THEN
    SELECT u.id
    INTO v_actor_user_id
    FROM auth.users AS u
    ORDER BY u.created_at NULLS LAST, u.id
    LIMIT 1;
  END IF;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot import % because auth.users is empty.', v_import_tag;
  END IF;

  SELECT d.id
  INTO v_district_id
  FROM public.districts AS d
  WHERE lower(d.name) = lower(v_district_name)
  LIMIT 1;

  IF v_district_id IS NULL THEN
    INSERT INTO public.districts (
      name,
      slug,
      default_currency,
      created_by,
      is_active
    )
    VALUES (
      v_district_name,
      'southgate-district',
      'USD',
      v_actor_user_id,
      TRUE
    )
    RETURNING id INTO v_district_id;
  END IF;

  INSERT INTO public.accounts (
    district_id,
    name,
    code,
    type,
    currency,
    status,
    description,
    sort_order
  )
  SELECT
    v_district_id,
    v_account_name,
    'CASH',
    'cash',
    'USD',
    'active',
    'Imported cash account used for the April 2026 SCCI workbook.',
    10
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.accounts AS a
    WHERE a.district_id = v_district_id
      AND lower(a.name) = lower(v_account_name)
  );

  SELECT a.id
  INTO v_account_id
  FROM public.accounts AS a
  WHERE a.district_id = v_district_id
    AND lower(a.name) = lower(v_account_name)
  ORDER BY a.created_at NULLS LAST, a.id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve the % account for %.', v_account_name, v_district_name;
  END IF;

  INSERT INTO public.funds (
    district_id,
    name,
    code,
    description,
    nature,
    is_restricted,
    is_active,
    requires_individual_member
  )
  SELECT
    v_district_id,
    seed.name,
    seed.code,
    seed.description,
    seed.nature::public.fund_nature,
    FALSE,
    TRUE,
    FALSE
  FROM (
    VALUES
      ('General Fund', 'GEN', 'Default operating fund for imported cashbook payments.', 'mixed'),
      ('Tithes', 'TITHE', 'Imported fund bucket from the April 2026 SCCI workbook.', 'mixed'),
      ('Free Will Offering', 'FWO', 'Imported fund bucket from the April 2026 SCCI workbook.', 'mixed'),
      ('Building', 'BUILD', 'Imported fund bucket from the April 2026 SCCI workbook.', 'mixed'),
      ('Ministries', 'MIN', 'Imported fund bucket from the April 2026 SCCI workbook.', 'mixed'),
      ('Missions', 'MISSION', 'Imported fund bucket from the April 2026 SCCI workbook.', 'mixed'),
      ('Multi Project Talents', 'MPT', 'Imported fund bucket from the April 2026 SCCI workbook.', 'mixed'),
      ('Other Income', 'OTHER_INC', 'Imported fund bucket from the April 2026 SCCI workbook.', 'mixed')
  ) AS seed(name, code, description, nature)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.funds AS f
    WHERE f.district_id = v_district_id
      AND lower(f.name) = lower(seed.name)
  );

  SELECT f.id
  INTO v_general_fund_id
  FROM public.funds AS f
  WHERE f.district_id = v_district_id
    AND lower(f.name) = 'general fund'
  ORDER BY f.created_at NULLS LAST, f.id
  LIMIT 1;

  IF v_general_fund_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve General Fund for %.', v_district_name;
  END IF;

  INSERT INTO public.account_opening_balances (
    account_id,
    district_id,
    effective_date,
    amount,
    currency,
    notes
  )
  VALUES (
    v_account_id,
    v_district_id,
    DATE '2026-04-01',
    0,
    'USD',
    'Imported from SCCI Cashbook.xlsx opening balance row for April 2026.'
  )
  ON CONFLICT (account_id, effective_date) DO UPDATE
  SET
    district_id = EXCLUDED.district_id,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    notes = EXCLUDED.notes;

  WITH raw_rows AS (
    SELECT *
    FROM jsonb_to_recordset($json$[{"row":5,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Anoshamisa B. Gondo","reference":"REC884801","amount":10,"bucket":"Other Income"},{"row":6,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Shamiso Gondo","reference":"REC884802","amount":10,"bucket":"Other Income"},{"row":7,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Christine Musa","reference":"REC884803","amount":10,"bucket":"Other Income"},{"row":8,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Meshia Muteve","reference":"REC884804","amount":10,"bucket":"Other Income"},{"row":9,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Ropafadzo F.S Muteve","reference":"REC884805","amount":10,"bucket":"Other Income"},{"row":10,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Vimbai Marima","reference":"REC884806","amount":10,"bucket":"Other Income"},{"row":11,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Lynia Chitukutuku","reference":"REC884807","amount":10,"bucket":"Other Income"},{"row":12,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Mary Zhuwawo","reference":"REC884808","amount":10,"bucket":"Other Income"},{"row":13,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Emily Jazire","reference":"REC884809","amount":10,"bucket":"Other Income"},{"row":14,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Susan Ruzhero","reference":"REC884810","amount":10,"bucket":"Other Income"},{"row":15,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Mutireke Ngambi","reference":"REC884811","amount":10,"bucket":"Other Income"},{"row":16,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Privilesy Mukamba","reference":"REC884812","amount":10,"bucket":"Other Income"},{"row":17,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Matirasa Zano","reference":"REC884813","amount":10,"bucket":"Other Income"},{"row":18,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Nyarai Dzinovengwa","reference":"REC884814","amount":10,"bucket":"Other Income"},{"row":19,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Takudzwa Mudete","reference":"REC884815","amount":10,"bucket":"Other Income"},{"row":20,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Angnella T. Musirinofa","reference":"REC884816","amount":10,"bucket":"Other Income"},{"row":21,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Nkem Mutero","reference":"REC884817","amount":10,"bucket":"Other Income"},{"row":22,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Collen Mutero","reference":"REC884818","amount":10,"bucket":"Other Income"},{"row":23,"date":"2026-04-04","kind":"receipt","description":"AMFCC School Registration","party":"Godric Muteve","reference":"REC884819","amount":10,"bucket":"Other Income"},{"row":24,"date":"2026-04-04","kind":"receipt","description":"Tithes","party":"Elder A. Yoroni","reference":"REC884820","amount":22,"bucket":"Tithes"},{"row":25,"date":"2026-04-05","kind":"receipt","description":"Provincial Roof","party":"Clara Chinofura","reference":"REC884821","amount":100,"bucket":"Other Income"},{"row":26,"date":"2026-04-05","kind":"receipt","description":"AMFCC School Fees","party":"Diamond Rukwava","reference":"REC884822","amount":20,"bucket":"Other Income"},{"row":27,"date":"2026-04-05","kind":"receipt","description":"District Vehicle","party":"Region 2","reference":"REC884823","amount":43,"bucket":"Other Income"},{"row":28,"date":"2026-04-05","kind":"receipt","description":"District Vehicle","party":"Region 3","reference":"REC884824","amount":123,"bucket":"Other Income"},{"row":29,"date":"2026-04-05","kind":"receipt","description":"District Vehicle","party":"Region 1","reference":"REC884825","amount":306,"bucket":"Other Income"},{"row":30,"date":"2026-04-05","kind":"receipt","description":"District Vehicle","party":"Region 4","reference":"REC884826","amount":48,"bucket":"Other Income"},{"row":31,"date":"2026-04-05","kind":"receipt","description":"Deeper Life Conference Administration","party":"Elder Padare","reference":"REC884827","amount":15,"bucket":"Other Income"},{"row":32,"date":"2026-04-05","kind":"receipt","description":"District Vehicle","party":"Region 1","reference":"REC884828","amount":50,"bucket":"Other Income"},{"row":33,"date":"2026-04-05","kind":"receipt","description":"District Vehicle","party":"DPs D \u0026 E. Machinge","reference":"REC884829","amount":25,"bucket":"Other Income"},{"row":34,"date":"2026-04-05","kind":"receipt","description":"Deeper Life Conference Administration","party":"Region 1","reference":"REC884830","amount":80,"bucket":"Other Income"},{"row":35,"date":"2026-04-05","kind":"receipt","description":"Deeper Life Conference Administration","party":"Region 1","reference":"REC884831","amount":37,"bucket":"Other Income"},{"row":36,"date":"2026-04-05","kind":"receipt","description":"Deeper Life Conference Administration","party":"Deacons Mr \u0026 Mrs Tembo","reference":"REC884832","amount":10,"bucket":"Other Income"},{"row":37,"date":"2026-04-05","kind":"receipt","description":"Provincial Roof","party":"Mr Mudehwe","reference":"REC884833","amount":20,"bucket":"Other Income"},{"row":38,"date":"2026-04-05","kind":"receipt","description":"AMFCC School Registration","party":"Espinah Chapwanya","reference":"REC884834","amount":10,"bucket":"Other Income"},{"row":39,"date":"2026-04-05","kind":"receipt","description":"AMFCC School Registration","party":"Saul Sidovo","reference":"REC884835","amount":10,"bucket":"Other Income"},{"row":40,"date":"2026-04-05","kind":"receipt","description":"AMFCC School Registration","party":"Winnie Sidovo","reference":"REC884836","amount":10,"bucket":"Other Income"},{"row":41,"date":"2026-04-05","kind":"receipt","description":"Deeper Life Conference Love Offering","party":"Elder Makumana","reference":"REC884837","amount":10,"bucket":"Other Income"},{"row":42,"date":"2026-04-05","kind":"receipt","description":"Deeper Life Conference Administration","party":"Deacon Masukume","reference":"REC884838","amount":15,"bucket":"Other Income"},{"row":43,"date":"2026-04-05","kind":"receipt","description":"National Account","party":"Youth","reference":"REC884839","amount":240,"bucket":"Ministries"},{"row":44,"date":"2026-04-05","kind":"receipt","description":"Zonal Account","party":"Youth","reference":"REC884840","amount":180,"bucket":"Ministries"},{"row":45,"date":"2026-04-05","kind":"receipt","description":"Takadzoka","party":"Youth","reference":"REC884841","amount":204,"bucket":"Ministries"},{"row":46,"date":"2026-04-06","kind":"payment","description":"AMFCC Part Time School Registrations","party":"AMFCC Part Time School","reference":"REQ996651","amount":190,"bucket":"Other"},{"row":47,"date":"2026-04-07","kind":"payment","description":"Busfare","party":"Indrive","reference":"REQ996651","amount":5,"bucket":"Busfare/Tollgate"},{"row":48,"date":"2026-04-08","kind":"receipt","description":"Deeper Life Conference Administration","party":"Elder J. Matambo","reference":"REC884842","amount":10,"bucket":"Other Income"},{"row":55,"date":"2026-04-09","kind":"payment","description":"Elders\u0027 Deeper Life Admistration","party":"Deeper Life Office","reference":"REQ996652","amount":1175,"bucket":"Other"},{"row":56,"date":"2026-04-09","kind":"payment","description":"Elders\u0027 Deeper Life Admistration","party":"Deeper Life Office","reference":"REQ996652","amount":236,"bucket":"Other"},{"row":57,"date":"2026-04-09","kind":"payment","description":"Elders\u0027 Deeper Life Love Offering","party":"Deeper Life Office","reference":"REQ996652","amount":100,"bucket":"Other"},{"row":58,"date":"2026-04-10","kind":"payment","description":"Elders\u0027 Deeper Life Love Offering","party":"Deeper Life Office","reference":"REQ996652","amount":30,"bucket":"Other"},{"row":59,"date":"2026-04-10","kind":"receipt","description":"Tithes - Patmos 2","party":"Patmos 2","reference":"MAST242951","amount":63,"bucket":"Tithes"},{"row":60,"date":"2026-04-10","kind":"receipt","description":"Free Will Offering","party":"Patmos 2","reference":"MAST242951","amount":7,"bucket":"Free Will Offering"},{"row":61,"date":"2026-04-10","kind":"receipt","description":"Tithes - Patmos 3","party":"Patmos 3","reference":"MAST242952","amount":95,"bucket":"Tithes"},{"row":62,"date":"2026-04-10","kind":"receipt","description":"Tithes - Patmos 3","party":"Patmos 3","reference":"MAST242953","amount":45,"bucket":"Tithes"},{"row":63,"date":"2026-04-10","kind":"receipt","description":"Free Will Offering","party":"Patmos 3","reference":"MAST242953","amount":7,"bucket":"Free Will Offering"},{"row":64,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Administration","party":"Assembly 1","reference":"REC884849","amount":35,"bucket":"Other Income"},{"row":65,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Administration","party":"Assembly 2","reference":"REC884850","amount":15,"bucket":"Other Income"},{"row":66,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Administration","party":"Assembly 4","reference":"REC884851","amount":15,"bucket":"Other Income"},{"row":67,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Administration","party":"Assembly 8","reference":"REC884852","amount":40,"bucket":"Other Income"},{"row":68,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Administration","party":"Assembly 9","reference":"REC884853","amount":1,"bucket":"Other Income"},{"row":69,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Administration","party":"District","reference":"REC884854","amount":45,"bucket":"Other Income"},{"row":70,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Administration","party":"District","reference":"REC884855","amount":30,"bucket":"Other Income"},{"row":71,"date":"2026-04-11","kind":"receipt","description":"Alms","party":"Region 1","reference":"REC884856","amount":10,"bucket":"Other Income"},{"row":72,"date":"2026-04-11","kind":"receipt","description":"Talents Conference","party":"Region 1","reference":"REC884857","amount":71,"bucket":"Other Income"},{"row":73,"date":"2026-04-11","kind":"receipt","description":"Free Will Offering","party":"Young Generation 2","reference":"REC884858","amount":1,"bucket":"Ministries"},{"row":74,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Administration","party":"District","reference":"REC884859","amount":22,"bucket":"Other Income"},{"row":75,"date":"2026-04-11","kind":"receipt","description":"Free Will Offering","party":"Young Generation 1","reference":"REC884860","amount":1,"bucket":"Ministries"},{"row":76,"date":"2026-04-11","kind":"receipt","description":"Deeper Life Conference Love Offering","party":"Assembly 9","reference":"REC884861","amount":3,"bucket":"Other Income"},{"row":77,"date":"2026-04-11","kind":"receipt","description":"Free Will Offering","party":"Assembly 9","reference":"REC884862","amount":24,"bucket":"Ministries"},{"row":78,"date":"2026-04-11","kind":"receipt","description":"Free Will Offering","party":"Region 4","reference":"REC884864","amount":17,"bucket":"Free Will Offering"},{"row":79,"date":"2026-04-11","kind":"receipt","description":"AMFCC School Registration","party":"Dainah Madanire","reference":"REC884863","amount":10,"bucket":"Other Income"},{"row":80,"date":"2026-04-12","kind":"receipt","description":"Tithes - Patmos 3","party":"Patmos 3","reference":"MAST242954","amount":130,"bucket":"Tithes"},{"row":81,"date":"2026-04-12","kind":"receipt","description":"Free Will Offering","party":"Patmos 3","reference":"MAST242954","amount":11,"bucket":"Free Will Offering"},{"row":82,"date":"2026-04-13","kind":"receipt","description":"Deeper Life Conference Administration","party":"Region 4","reference":"REC884865","amount":40,"bucket":"Other Income"},{"row":83,"date":"2026-04-13","kind":"receipt","description":"Deeper Life Conference Love Offering","party":"Region 4","reference":"REC884866","amount":5,"bucket":"Other Income"},{"row":84,"date":"2026-04-13","kind":"receipt","description":"Deeper Life Conference Love Offering","party":"Region 2","reference":"REC884867","amount":75,"bucket":"Other Income"},{"row":85,"date":"2026-04-13","kind":"receipt","description":"Deeper Life Conference Love Offering","party":"Region 2","reference":"REC884868","amount":20,"bucket":"Other Income"},{"row":86,"date":"2026-04-13","kind":"receipt","description":"Crusade Fund","party":"Region 4","reference":"REC884869","amount":1,"bucket":"Other Income"},{"row":87,"date":"2026-04-13","kind":"receipt","description":"Talents Conference","party":"Region 3","reference":"REC884870","amount":23,"bucket":"Other Income"},{"row":88,"date":"2026-04-13","kind":"receipt","description":"Deeper Life Conference Love Offering","party":"Region 4","reference":"REC884871","amount":8,"bucket":"Other Income"},{"row":89,"date":"2026-04-13","kind":"receipt","description":"Deeper Life Conference Administration","party":"Region 3","reference":"REC884872","amount":68,"bucket":"Other Income"},{"row":90,"date":"2026-04-13","kind":"receipt","description":"Deeper Life Conference Love Offering","party":"Region 3","reference":"REC884873","amount":69,"bucket":"Other Income"},{"row":91,"date":"2026-04-13","kind":"receipt","description":"Talents Conference","party":"Region 4","reference":"REC884874","amount":21,"bucket":"Other Income"},{"row":92,"date":"2026-04-13","kind":"receipt","description":"Talents Conference","party":"Region 5","reference":"REC884875","amount":4,"bucket":"Other Income"},{"row":93,"date":"2026-04-13","kind":"receipt","description":"Alms","party":"Patmos 1","reference":"REC884876","amount":4,"bucket":"Other Income"},{"row":94,"date":"2026-04-13","kind":"receipt","description":"Deeper Life Conference Love Offering","party":"Patmos 1","reference":"REC884877","amount":23,"bucket":"Other Income"},{"row":95,"date":"2026-04-13","kind":"receipt","description":"Free Will Offering","party":"Child Evangelism","reference":"REC884878","amount":4,"bucket":"Free Will Offering"},{"row":96,"date":"2026-04-13","kind":"receipt","description":"ODCFund","party":"Child Evangelism","reference":"REC884879","amount":3,"bucket":"Other Income"},{"row":97,"date":"2026-04-13","kind":"receipt","description":"Tithes - Patmos 2","party":"Patmos 2","reference":"MAST242955","amount":20,"bucket":"Tithes"},{"row":98,"date":"2026-04-13","kind":"receipt","description":"Free Will Offering","party":"Patmos 2","reference":"MAST242955","amount":6,"bucket":"Free Will Offering"},{"row":99,"date":"2026-04-14","kind":"receipt","description":"Deeper Life Conference Administration","party":"Deacon P. Mhlope","reference":"REC884880","amount":15,"bucket":"Other Income"},{"row":100,"date":"2026-04-14","kind":"receipt","description":"Deeper Life Conference Administration","party":"Deacon P. Chinofura","reference":"REC884881","amount":15,"bucket":"Other Income"},{"row":101,"date":"2026-04-14","kind":"payment","description":"National Account","party":"Youth","reference":"REQ996654","amount":240,"bucket":"Other"},{"row":102,"date":"2026-04-14","kind":"payment","description":"Zonal Account","party":"Youth","reference":"REQ996654","amount":180,"bucket":"Other"},{"row":103,"date":"2026-04-14","kind":"payment","description":"Takadzoka","party":"Youth","reference":"REQ996654","amount":204,"bucket":"Other"},{"row":104,"date":"2026-04-15","kind":"payment","description":"HP Laptop","party":"Cansan Electronics","reference":"REQ996655","amount":600,"bucket":"IT \u0026 Stationery Consumables"},{"row":105,"date":"2026-04-15","kind":"payment","description":"Busfare To Town","party":"","reference":"REQ996655","amount":3,"bucket":"Busfare/Tollgate"},{"row":106,"date":"2026-04-16","kind":"payment","description":"Busfare To ECCI","party":"","reference":"REQ996655","amount":2,"bucket":"Busfare/Tollgate"},{"row":107,"date":"2026-04-16","kind":"payment","description":"Rent","party":"","reference":"REQ996656","amount":70,"bucket":"Rentals"},{"row":108,"date":"2026-04-16","kind":"receipt","description":"Tithes - Assembly 3","party":"Assermbly 3","reference":"MAST242956","amount":24,"bucket":"Tithes"},{"row":109,"date":"2026-04-16","kind":"receipt","description":"Free Will Offering","party":"Assermbly 3","reference":"MAST242956","amount":18,"bucket":"Free Will Offering"},{"row":110,"date":"2026-04-17","kind":"receipt","description":"Deeper Life Conference Administration","party":"Region 3","reference":"REC884882","amount":15,"bucket":"Other Income"},{"row":111,"date":"2026-04-17","kind":"payment","description":"Laptop Bag","party":"Laptop City","reference":"REQ996657","amount":10,"bucket":"IT \u0026 Stationery Consumables"},{"row":112,"date":"2026-04-17","kind":"payment","description":"Stationery","party":"Planas Stationers","reference":"REQ996657","amount":9,"bucket":"IT \u0026 Stationery Consumables"},{"row":113,"date":"2026-04-17","kind":"payment","description":"Busfare To ECCI","party":"","reference":"REQ996657","amount":2,"bucket":"Busfare/Tollgate"},{"row":114,"date":"2026-04-17","kind":"payment","description":"Busfare To Town","party":"","reference":"REQ996657","amount":2,"bucket":"Busfare/Tollgate"},{"row":115,"date":"2026-04-19","kind":"receipt","description":"AMFCC School Registration","party":"Innocent Chikoto","reference":"REC884883","amount":10,"bucket":"Other Income"},{"row":116,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Region 1","reference":"REC884884","amount":72,"bucket":"Other Income"},{"row":117,"date":"2026-04-19","kind":"receipt","description":"Missions","party":"Region 1","reference":"REC884885","amount":17,"bucket":"Missions"},{"row":118,"date":"2026-04-19","kind":"receipt","description":"Free Will Offering","party":"Region 4","reference":"REC884886","amount":10,"bucket":"Free Will Offering"},{"row":119,"date":"2026-04-19","kind":"receipt","description":"Crusade Fund","party":"Region 4","reference":"REC884887","amount":3,"bucket":"Other Income"},{"row":120,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Region 1","reference":"REC884888","amount":10,"bucket":"Other Income"},{"row":121,"date":"2026-04-19","kind":"receipt","description":"Transfer From ECCI","party":"ECCI","reference":"REC884889","amount":1210,"bucket":"Other Income"},{"row":122,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Elder Pamhare","reference":"REC884890","amount":10,"bucket":"Other Income"},{"row":123,"date":"2026-04-19","kind":"receipt","description":"Alms","party":"District","reference":"REC884891","amount":6,"bucket":"Other Income"},{"row":124,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Region 1","reference":"REC884892","amount":45,"bucket":"Other Income"},{"row":125,"date":"2026-04-19","kind":"receipt","description":"Go Quickly Subscriptions","party":"Region 1","reference":"REC884893","amount":43,"bucket":"Ministries"},{"row":126,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Deacon A. Kapofu","reference":"REC884894","amount":15,"bucket":"Other Income"},{"row":127,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Love Offering","party":"Deacon A. Kapofu","reference":"REC884895","amount":10,"bucket":"Other Income"},{"row":128,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Deacon Tapfuma","reference":"REC884896","amount":10,"bucket":"Other Income"},{"row":129,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Deacon S. Miti","reference":"REC884897","amount":15,"bucket":"Other Income"},{"row":130,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Deacon O. Tapfuma","reference":"REC884898","amount":15,"bucket":"Other Income"},{"row":131,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Deaxcon V. Tapfuma","reference":"REC884899","amount":15,"bucket":"Other Income"},{"row":132,"date":"2026-04-19","kind":"receipt","description":"AMFCC School Fees","party":"Ruth Makumbiza","reference":"REC884900","amount":20,"bucket":"Other Income"},{"row":133,"date":"2026-04-19","kind":"receipt","description":"AMFCC School Registration","party":"Dakarai Chinyama","reference":"REC884901","amount":10,"bucket":"Other Income"},{"row":134,"date":"2026-04-19","kind":"receipt","description":"Go Quickly Free Will Offering","party":"Region 4","reference":"REC884902","amount":33,"bucket":"Free Will Offering"},{"row":135,"date":"2026-04-19","kind":"receipt","description":"Go Quickly Socks","party":"Region 4","reference":"REC884903","amount":30,"bucket":"Ministries"},{"row":136,"date":"2026-04-19","kind":"receipt","description":"Go Quickly Subscriptions","party":"Region 4","reference":"REC884904","amount":6,"bucket":"Ministries"},{"row":137,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Love Offering","party":"Region 1","reference":"REC884905","amount":64,"bucket":"Other Income"},{"row":138,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Region 1","reference":"REC884906","amount":50,"bucket":"Other Income"},{"row":139,"date":"2026-04-19","kind":"receipt","description":"Deeper Life Administration","party":"Deacon A. Chiwaura","reference":"REC884907","amount":10,"bucket":"Other Income"},{"row":140,"date":"2026-04-19","kind":"receipt","description":"AMFCC School Registration","party":"Linah Mabuto","reference":"REC884908","amount":10,"bucket":"Other Income"},{"row":141,"date":"2026-04-23","kind":"receipt","description":"Transfer From ECCI","party":"ECCI","reference":"REC884909","amount":1109,"bucket":"Other Income"},{"row":142,"date":"2026-04-23","kind":"receipt","description":"Deeper Life Administration","party":"Elder L. Charimba","reference":"REC884910","amount":15,"bucket":"Other Income"},{"row":143,"date":"2026-04-23","kind":"receipt","description":"Deeper Life Administration","party":"Nigel Chabata","reference":"REC884911","amount":15,"bucket":"Other Income"},{"row":144,"date":"2026-04-23","kind":"receipt","description":"Deeper Life Administration","party":"Deacon M. Tangwena","reference":"REC884912","amount":15,"bucket":"Other Income"},{"row":145,"date":"2026-04-23","kind":"receipt","description":"Deeper Life Administration","party":"Deacon P. Mhare","reference":"REC884913","amount":15,"bucket":"Other Income"},{"row":146,"date":"2026-04-24","kind":"receipt","description":"Deeper Life Administration","party":"Deaconess O. Gonese","reference":"REC884914","amount":15,"bucket":"Other Income"},{"row":147,"date":"2026-04-26","kind":"receipt","description":"Deeper Life Administration","party":"Deacons Mr \u0026 Mrs Muza","reference":"REC884915","amount":30,"bucket":"Other Income"},{"row":148,"date":"2026-04-26","kind":"receipt","description":"District Vehicle","party":"Mrs Nyadundu","reference":"REC884916","amount":100,"bucket":"Other Income"},{"row":149,"date":"2026-04-26","kind":"receipt","description":"Alms","party":"Region 1","reference":"REC884917","amount":4,"bucket":"Other Income"},{"row":150,"date":"2026-04-26","kind":"receipt","description":"Anniversary","party":"Region 1","reference":"REC884918","amount":22,"bucket":"Other Income"},{"row":151,"date":"2026-04-26","kind":"receipt","description":"Free Will Offering","party":"Child Evangelism","reference":"REC884919","amount":6,"bucket":"Ministries"},{"row":152,"date":"2026-04-26","kind":"receipt","description":"Deeper Life Administration","party":"Region 1","reference":"REC884920","amount":15,"bucket":"Other Income"},{"row":153,"date":"2026-04-26","kind":"receipt","description":"CE Cement","party":"Child Evangelism","reference":"REC884921","amount":51,"bucket":"Ministries"},{"row":154,"date":"2026-04-26","kind":"receipt","description":"Deeper Life Administration","party":"Deacon T. Joka","reference":"REC884922","amount":15,"bucket":"Other Income"},{"row":155,"date":"2026-04-26","kind":"receipt","description":"Reimbursement","party":"Elder Chitambo","reference":"REC884923","amount":65,"bucket":"Other Income"},{"row":156,"date":"2026-04-26","kind":"receipt","description":"Anniversary","party":"Region 1","reference":"REC884924","amount":10,"bucket":"Other Income"},{"row":157,"date":"2026-04-26","kind":"receipt","description":"Anniversary","party":"Region 1","reference":"REC884925","amount":30,"bucket":"Other Income"},{"row":158,"date":"2026-04-26","kind":"receipt","description":"ODCFund","party":"Child Evangelism","reference":"REC884926","amount":23,"bucket":"Other Income"},{"row":159,"date":"2026-04-26","kind":"receipt","description":"Takadzoka","party":"Youth","reference":"REC884927","amount":331,"bucket":"Ministries"},{"row":160,"date":"2026-04-26","kind":"receipt","description":"CE Cement","party":"Child Evangelism","reference":"REC884928","amount":5,"bucket":"Ministries"},{"row":161,"date":"2026-04-26","kind":"receipt","description":"CE Cement","party":"Child Evangelism","reference":"REC884929","amount":6,"bucket":"Ministries"},{"row":162,"date":"2026-04-26","kind":"receipt","description":"AMFCC Exam Fees","party":"Welm Mhaka","reference":"REC884930","amount":20,"bucket":"Other Income"},{"row":163,"date":"2026-04-26","kind":"receipt","description":"Anniversary","party":"Platinum Assembly","reference":"REC884931","amount":20,"bucket":"Other Income"},{"row":164,"date":"2026-04-26","kind":"receipt","description":"Anniversary","party":"Platinum Assembly","reference":"REC884932","amount":10,"bucket":"Other Income"},{"row":165,"date":"2026-04-26","kind":"receipt","description":"Anniversary","party":"Assembly 1","reference":"REC884933","amount":5,"bucket":"Other Income"},{"row":166,"date":"2026-04-27","kind":"receipt","description":"Anniversary","party":"Patmos 3","reference":"REC884934","amount":40,"bucket":"Other Income"},{"row":167,"date":"2026-04-27","kind":"receipt","description":"Free Will Offering","party":"Patmos 3","reference":"REC884935","amount":6,"bucket":"Free Will Offering"},{"row":168,"date":"2026-04-27","kind":"receipt","description":"Go Quickly Subscriptions","party":"Region 2","reference":"REC884936","amount":12,"bucket":"Ministries"},{"row":169,"date":"2026-04-27","kind":"receipt","description":"Go Quickly Free Will Offering","party":"Region 2","reference":"REC884937","amount":5,"bucket":"Ministries"},{"row":170,"date":"2026-04-27","kind":"receipt","description":"Go Quickly Subscriptions","party":"Region 2","reference":"REC884938","amount":1,"bucket":"Ministries"},{"row":171,"date":"2026-04-27","kind":"receipt","description":"Go Quickly Provincial Subscriptions","party":"Region 2","reference":"REC884939","amount":20,"bucket":"Ministries"},{"row":172,"date":"2026-04-27","kind":"receipt","description":"Free Will Offering","party":"Mount Zion","reference":"REC884940","amount":34,"bucket":"Free Will Offering"},{"row":173,"date":"2026-04-27","kind":"receipt","description":"Anniversary","party":"Patmos 2","reference":"REC884941","amount":31,"bucket":"Other Income"},{"row":174,"date":"2026-04-27","kind":"receipt","description":"Deeper Life Administration","party":"Region 3","reference":"REC884942","amount":90,"bucket":"Other Income"},{"row":175,"date":"2026-04-27","kind":"receipt","description":"Reimbursement","party":"Elder Chitambo","reference":"REC884943","amount":15,"bucket":"Other Income"}]$json$::jsonb) AS src(
      row INTEGER,
      date DATE,
      kind TEXT,
      description TEXT,
      party TEXT,
      reference TEXT,
      amount NUMERIC(12, 2),
      bucket TEXT
    )
  ), prepared AS (
    SELECT
      (
        substr(md5(format('%s|row:%s|ref:%s', v_import_tag, src.row, coalesce(src.reference, ''))), 1, 8)
        || '-' || substr(md5(format('%s|row:%s|ref:%s', v_import_tag, src.row, coalesce(src.reference, ''))), 9, 4)
        || '-' || substr(md5(format('%s|row:%s|ref:%s', v_import_tag, src.row, coalesce(src.reference, ''))), 13, 4)
        || '-' || substr(md5(format('%s|row:%s|ref:%s', v_import_tag, src.row, coalesce(src.reference, ''))), 17, 4)
        || '-' || substr(md5(format('%s|row:%s|ref:%s', v_import_tag, src.row, coalesce(src.reference, ''))), 21, 12)
      )::UUID AS client_generated_id,
      src.row,
      src.date,
      src.kind::public.transaction_kind AS kind,
      CASE
        WHEN src.kind = 'payment' THEN 'out'::public.cashbook_effect_direction
        ELSE 'in'::public.cashbook_effect_direction
      END AS effect_direction,
      CASE
        WHEN src.kind = 'payment' THEN v_general_fund_id
        ELSE (
          SELECT f.id
          FROM public.funds AS f
          WHERE f.district_id = v_district_id
            AND lower(f.name) = lower(src.bucket)
          ORDER BY f.created_at NULLS LAST, f.id
          LIMIT 1
        )
      END AS fund_id,
      nullif(btrim(src.party), '') AS counterparty,
      nullif(btrim(src.reference), '') AS reference_number,
      CASE
        WHEN src.kind = 'payment' AND nullif(btrim(src.bucket), '') IS NOT NULL THEN src.description || ' | Expense category: ' || src.bucket
        ELSE src.description
      END AS narration,
      src.amount,
      src.bucket
    FROM raw_rows AS src
  ), inserted AS (
    INSERT INTO public.cashbook_transactions (
      district_id,
      account_id,
      fund_id,
      member_id,
      counterparty_id,
      kind,
      effect_direction,
      status,
      transaction_date,
      reference_number,
      counterparty,
      narration,
      currency,
      total_amount,
      created_by,
      submitted_by,
      approved_by,
      posted_by,
      submitted_at,
      approved_at,
      posted_at,
      created_at,
      updated_at,
      client_generated_id,
      device_id
    )
    SELECT
      v_district_id,
      v_account_id,
      prepared.fund_id,
      NULL,
      NULL,
      prepared.kind,
      prepared.effect_direction,
      'posted',
      prepared.date,
      prepared.reference_number,
      prepared.counterparty,
      prepared.narration,
      'USD',
      prepared.amount,
      v_actor_user_id,
      v_actor_user_id,
      v_actor_user_id,
      v_actor_user_id,
      prepared.date::timestamp + interval '12 hours',
      prepared.date::timestamp + interval '12 hours',
      prepared.date::timestamp + interval '12 hours',
      prepared.date::timestamp + interval '12 hours',
      prepared.date::timestamp + interval '12 hours',
      prepared.client_generated_id,
      'migration:' || v_import_tag
    FROM prepared
    ON CONFLICT DO NOTHING
    RETURNING id, created_by
  )
  INSERT INTO public.cashbook_audit_log (
    transaction_id,
    actor_id,
    action,
    old_status,
    new_status,
    details
  )
  SELECT
    inserted.id,
    inserted.created_by,
    'posted',
    'approved',
    'posted',
    jsonb_build_object(
      'import_tag', v_import_tag,
      'source_workbook', 'SCCI Cashbook.xlsx'
    )
  FROM inserted
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.cashbook_audit_log AS log
    WHERE log.transaction_id = inserted.id
      AND log.action = 'posted'
  );
END $$;
