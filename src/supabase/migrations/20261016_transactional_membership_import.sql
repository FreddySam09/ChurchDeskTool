
-- Church Desk: transactional Excel membership import.
-- All database writes performed by this function are rolled back if any
-- validation or insert fails.
--
-- Expected workbook fields include:
-- Membership Number, Record Type, Branch Suffix, Is Head, Name,
-- Relationship to Head, Married To, Date of Marriage, Fellowship / Groups
-- and the other membership/member detail columns used by the import modal.
--
-- Record Type = Membership: main membership.
-- Record Type = Branch: lettered branch within that membership.
-- A branch head uses Is Head = Yes and a single-letter Branch Suffix.

CREATE OR REPLACE FUNCTION public.import_memberships_transactional(
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r jsonb;
  v_number text;
  v_suffix text;
  v_type text;
  v_is_head boolean;
  v_membership_id uuid;
  v_head_id uuid;
  v_result jsonb;
  v_member_result jsonb;
  v_member_id uuid;
  v_person_id text;
  v_branch_id uuid;
  v_group_id uuid;
  v_groups jsonb;
  v_created jsonb := '[]'::jsonb;
  v_memberships jsonb := '[]'::jsonb;
  v_existing jsonb;
  v_relationship text;
  v_married_to text;
  v_related_id uuid;
  v_related_row jsonb;
  v_wedding_date date;
  v_imported integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to import memberships.';
  END IF;

  IF p_rows IS NULL
     OR jsonb_typeof(p_rows) <> 'array'
     OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'The import must contain at least one row.';
  END IF;

  ---------------------------------------------------------------------------
  -- PASS 0: validate the rows and group IDs before creating any records.
  ---------------------------------------------------------------------------

  FOR r IN
    SELECT value
    FROM jsonb_array_elements(p_rows)
  LOOP
    IF NULLIF(BTRIM(r->>'Name'), '') IS NULL THEN
      RAISE EXCEPTION 'A row is missing the member name.';
    END IF;

    IF NULLIF(BTRIM(r->>'Membership Number'), '') IS NULL THEN
      RAISE EXCEPTION 'A row for % is missing its membership number.',
        r->>'Name';
    END IF;

    v_type := COALESCE(NULLIF(BTRIM(r->>'Record Type'), ''), 'Membership');

    IF v_type NOT IN ('Membership', 'Branch') THEN
      RAISE EXCEPTION 'Invalid Record Type for %: %.',
        r->>'Name', v_type;
    END IF;

    IF v_type = 'Branch'
       AND COALESCE(BTRIM(r->>'Branch Suffix'), '') !~* '^[A-Z]$' THEN
      RAISE EXCEPTION
        'Branch member % must have a single-letter branch suffix A-Z.',
        r->>'Name';
    END IF;

    v_groups := COALESCE(r->'group_ids', '[]'::jsonb);

    IF jsonb_typeof(v_groups) <> 'array' THEN
      RAISE EXCEPTION
        'Group assignments must be an array for member %.',
        r->>'Name';
    END IF;

    FOR v_group_id IN
      SELECT DISTINCT value::text::uuid
      FROM jsonb_array_elements_text(v_groups)
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.church_groups g
        WHERE g.id = v_group_id
          AND g.group_status = 'Active'
      ) THEN
        RAISE EXCEPTION
          'One or more groups are missing or inactive for member %.',
          r->>'Name';
      END IF;
    END LOOP;
  END LOOP;

  ---------------------------------------------------------------------------
  -- PASS 1: create each main membership and its head.
  ---------------------------------------------------------------------------

  FOR r IN
    SELECT value
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS x(value, ord)
    WHERE COALESCE(NULLIF(BTRIM(value->>'Record Type'), ''), 'Membership')
            = 'Membership'
      AND LOWER(COALESCE(value->>'Is Head', 'No')) = 'yes'
    ORDER BY ord
  LOOP
    v_number := BTRIM(r->>'Membership Number');

    IF EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE LOWER(m.membership_number) = LOWER(v_number)
    ) THEN
      RAISE EXCEPTION
        'Membership number % already exists. Nothing from this import was saved.',
        v_number;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_memberships) AS x(item)
      WHERE LOWER(item->>'number') = LOWER(v_number)
    ) THEN
      RAISE EXCEPTION
        'More than one main membership head was supplied for membership number %.',
        v_number;
    END IF;

    v_result := public.create_membership_with_head(
      jsonb_build_object(
        'name', r->>'Name',
        'gender', NULLIF(r->>'Gender', ''),
        'date_of_birth', NULLIF(r->>'Date of Birth', ''),
        'marital_status',
          COALESCE(NULLIF(r->>'Marital Status', ''), 'Single'),
        'baptism_status',
          COALESCE(NULLIF(r->>'Baptism Status', ''), 'Unknown'),
        'date_of_baptism', NULLIF(r->>'Date of Baptism', ''),
        'occupation_or_studying', NULLIF(r->>'Occupation', ''),
        'phone_number', NULLIF(r->>'Phone Number', ''),
        'email', NULLIF(r->>'Email', '')
      ),
      jsonb_build_object(
        'membership_number', v_number,
        'door_number', NULLIF(r->>'Door Number', ''),
        'street_name', NULLIF(r->>'Street Name', ''),
        'area', NULLIF(r->>'Area', ''),
        'city', NULLIF(r->>'City', ''),
        'pincode', NULLIF(r->>'Pincode', ''),
        'landmark', NULLIF(r->>'Landmark', ''),
        'primary_phone_number', NULLIF(r->>'Primary Phone Number', ''),
        'alternate_phone_number', NULLIF(r->>'Alternate Phone Number', ''),
        'email', NULLIF(r->>'Membership Email', ''),
        'year_joined', NULLIF(r->>'Year Joined', '')
      )
    );

    v_membership_id := (v_result->>'membership_row_id')::uuid;
    v_head_id := (v_result->>'head_member_id')::uuid;

    v_memberships := v_memberships || jsonb_build_array(
      jsonb_build_object(
        'number', v_number,
        'membership_id', v_membership_id,
        'head_id', v_head_id
      )
    );

    v_created := v_created || jsonb_build_array(
      jsonb_build_object(
        'number', v_number,
        'suffix', '',
        'name', r->>'Name',
        'member_id', v_head_id,
        'membership_id', v_membership_id,
        'branch_id', NULL,
        'is_head', true,
        'row', r
      )
    );

    IF NULLIF(r->>'Membership Status', '') IS NOT NULL THEN
      UPDATE public.memberships
      SET membership_status = r->>'Membership Status'
      WHERE id = v_membership_id;
    END IF;

    -- The main head receives their own selected group assignments.
    FOR v_group_id IN
      SELECT DISTINCT value::text::uuid
      FROM jsonb_array_elements_text(
        COALESCE(r->'group_ids', '[]'::jsonb)
      )
    LOOP
      PERFORM public.set_member_group_assignment(
        v_head_id,
        v_group_id,
        NULL,
        CURRENT_DATE,
        NULL
      );
    END LOOP;

    v_imported := v_imported + 1;
  END LOOP;

  IF jsonb_array_length(v_memberships) = 0 THEN
    RAISE EXCEPTION
      'No main membership head was found. Add one Membership row with Is Head = Yes for each new membership number.';
  END IF;

  ---------------------------------------------------------------------------
  -- PASS 2: create branch members and other household members.
  -- Relationships are linked separately in pass 3, so branch spouses can
  -- be connected to their actual branch head.
  ---------------------------------------------------------------------------

  FOR r IN
    SELECT value
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS x(value, ord)
    WHERE NOT (
      COALESCE(NULLIF(BTRIM(value->>'Record Type'), ''), 'Membership')
        = 'Membership'
      AND LOWER(COALESCE(value->>'Is Head', 'No')) = 'yes'
    )
    ORDER BY ord
  LOOP
    v_number := BTRIM(r->>'Membership Number');
    v_type := COALESCE(NULLIF(BTRIM(r->>'Record Type'), ''), 'Membership');
    v_suffix := CASE
      WHEN v_type = 'Branch'
        THEN UPPER(BTRIM(COALESCE(r->>'Branch Suffix', '')))
      ELSE ''
    END;
    v_is_head := LOWER(COALESCE(r->>'Is Head', 'No')) = 'yes';

    SELECT (item->>'membership_id')::uuid
    INTO v_membership_id
    FROM jsonb_array_elements(v_memberships) AS x(item)
    WHERE LOWER(item->>'number') = LOWER(v_number)
    LIMIT 1;

    IF v_membership_id IS NULL THEN
      RAISE EXCEPTION
        'Membership number % needs a main Membership head row in this same import.',
        v_number;
    END IF;

    v_relationship := NULLIF(BTRIM(r->>'Relationship to Head'), '');

    -- Pass NULL for relationship here. The existing RPC attaches spouse
    -- relationships to the main head; pass 3 creates the correct link.
    v_member_result := public.add_member_to_membership_with_groups(
      v_membership_id,
      jsonb_build_object(
        'name', r->>'Name',
        'gender', NULLIF(r->>'Gender', ''),
        'date_of_birth', NULLIF(r->>'Date of Birth', ''),
        'marital_status',
          CASE
            WHEN LOWER(COALESCE(v_relationship, '')) = 'spouse'
              THEN 'Married'
            ELSE COALESCE(NULLIF(r->>'Marital Status', ''), 'Single')
          END,
        'baptism_status',
          COALESCE(NULLIF(r->>'Baptism Status', ''), 'Unknown'),
        'date_of_baptism', NULLIF(r->>'Date of Baptism', ''),
        'occupation_or_studying', NULLIF(r->>'Occupation', ''),
        'phone_number', NULLIF(r->>'Phone Number', ''),
        'email', NULLIF(r->>'Email', '')
      ),
      NULLIF(v_suffix, ''),
      NULL,
      NULL,
      ARRAY(
        SELECT value::text::uuid
        FROM jsonb_array_elements_text(
          COALESCE(r->'group_ids', '[]'::jsonb)
        )
      )
    );

    v_member_id := (v_member_result->>'member_row_id')::uuid;
    v_person_id := v_member_result->>'person_id';
    v_branch_id := NULLIF(v_member_result->>'branch_id', '')::uuid;

    UPDATE public.membership_structure_assignments
    SET relationship_to_head =
      CASE
        WHEN v_is_head THEN 'Head'
        ELSE COALESCE(v_relationship, 'Other')
      END
    WHERE member_id = v_member_id
      AND membership_id = v_membership_id
      AND valid_until IS NULL;

    v_created := v_created || jsonb_build_array(
      jsonb_build_object(
        'number', v_number,
        'suffix', v_suffix,
        'name', r->>'Name',
        'member_id', v_member_id,
        'membership_id', v_membership_id,
        'branch_id', v_branch_id,
        'is_head', v_is_head,
        'row', r
      )
    );

    v_imported := v_imported + 1;
  END LOOP;

  ---------------------------------------------------------------------------
  -- PASS 3: record family relationships independently of current placement.
  ---------------------------------------------------------------------------

  FOR v_existing IN
    SELECT value
    FROM jsonb_array_elements(v_created)
  LOOP
    r := v_existing->'row';
    v_relationship := NULLIF(BTRIM(r->>'Relationship to Head'), '');
    v_number := v_existing->>'number';
    v_suffix := COALESCE(v_existing->>'suffix', '');
    v_member_id := (v_existing->>'member_id')::uuid;
    v_married_to := NULLIF(BTRIM(r->>'Married To'), '');

    -- Resolve the head of this exact main or branch household.
    SELECT (item->>'member_id')::uuid
    INTO v_head_id
    FROM jsonb_array_elements(v_created) AS x(item)
    WHERE LOWER(item->>'number') = LOWER(v_number)
      AND UPPER(COALESCE(item->>'suffix', '')) = UPPER(v_suffix)
      AND COALESCE((item->>'is_head')::boolean, false)
    LIMIT 1;

    IF v_relationship = 'Spouse' THEN
      IF v_married_to IS NOT NULL THEN
        SELECT item
        INTO v_related_row
        FROM jsonb_array_elements(v_created) AS x(item)
        WHERE LOWER(item->>'number') = LOWER(v_number)
          AND UPPER(COALESCE(item->>'suffix', '')) = UPPER(v_suffix)
          AND LOWER(item->>'name') = LOWER(v_married_to)
        LIMIT 1;

        v_related_id := NULLIF(v_related_row->>'member_id', '')::uuid;
      ELSE
        v_related_id := v_head_id;
      END IF;

      IF v_related_id IS NULL OR v_related_id = v_member_id THEN
        RAISE EXCEPTION
          'Could not resolve the spouse for % in membership % (branch %). Check the Married To value.',
          r->>'Name', v_number, v_suffix;
      END IF;

      v_wedding_date := NULLIF(r->>'Date of Marriage', '')::date;

      IF v_wedding_date IS NULL THEN
        SELECT NULLIF(item->'row'->>'Date of Marriage', '')::date
        INTO v_wedding_date
        FROM jsonb_array_elements(v_created) AS x(item)
        WHERE (item->>'member_id')::uuid = v_related_id
        LIMIT 1;
      END IF;

      IF v_wedding_date IS NULL THEN
        RAISE EXCEPTION
          'A wedding date is required for % and %.',
          r->>'Name', v_married_to;
      END IF;

      UPDATE public.members
      SET marital_status = 'Married'
      WHERE id IN (v_member_id, v_related_id);

      IF NOT EXISTS (
        SELECT 1
        FROM public.membership_relationships mr
        WHERE mr.relationship_type = 'Spouse'
          AND mr.member_id = LEAST(v_member_id, v_related_id)
          AND mr.related_member_id = GREATEST(v_member_id, v_related_id)
      ) THEN
        INSERT INTO public.membership_relationships (
          member_id,
          related_member_id,
          relationship_type,
          date_of_marriage,
          recorded_by
        )
        VALUES (
          LEAST(v_member_id, v_related_id),
          GREATEST(v_member_id, v_related_id),
          'Spouse',
          v_wedding_date,
          auth.uid()
        );
      ELSE
        UPDATE public.membership_relationships
        SET date_of_marriage = v_wedding_date
        WHERE relationship_type = 'Spouse'
          AND member_id = LEAST(v_member_id, v_related_id)
          AND related_member_id = GREATEST(v_member_id, v_related_id);
      END IF;

    ELSIF v_relationship IN ('Son', 'Daughter', 'Child') THEN
      -- A branch head can remain the child of the main head.
      -- Current branch placement is stored separately from this family link.
      IF v_is_head AND v_suffix <> '' THEN
        SELECT (item->>'member_id')::uuid
        INTO v_related_id
        FROM jsonb_array_elements(v_created) AS x(item)
        WHERE LOWER(item->>'number') = LOWER(v_number)
          AND COALESCE(item->>'suffix', '') = ''
          AND COALESCE((item->>'is_head')::boolean, false)
        LIMIT 1;
      ELSE
        v_related_id := v_head_id;
      END IF;

      IF v_related_id IS NOT NULL
         AND v_related_id <> v_member_id
         AND NOT EXISTS (
           SELECT 1
           FROM public.membership_relationships mr
           WHERE mr.member_id = v_member_id
             AND mr.related_member_id = v_related_id
             AND mr.relationship_type = 'Child'
         ) THEN
        INSERT INTO public.membership_relationships (
          member_id,
          related_member_id,
          relationship_type,
          recorded_by
        )
        VALUES (
          v_member_id,
          v_related_id,
          'Child',
          auth.uid()
        );
      END IF;

    ELSIF v_relationship = 'Parent' THEN
      IF v_head_id IS NOT NULL
         AND v_head_id <> v_member_id
         AND NOT EXISTS (
           SELECT 1
           FROM public.membership_relationships mr
           WHERE mr.member_id = v_head_id
             AND mr.related_member_id = v_member_id
             AND mr.relationship_type = 'Child'
         ) THEN
        INSERT INTO public.membership_relationships (
          member_id,
          related_member_id,
          relationship_type,
          recorded_by
        )
        VALUES (
          v_head_id,
          v_member_id,
          'Child',
          auth.uid()
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'imported_rows', v_imported,
    'created_memberships', jsonb_array_length(v_memberships),
    'created_people', jsonb_array_length(v_created)
  );
END;
$function$;

REVOKE ALL
ON FUNCTION public.import_memberships_transactional(jsonb)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.import_memberships_transactional(jsonb)
TO authenticated;
