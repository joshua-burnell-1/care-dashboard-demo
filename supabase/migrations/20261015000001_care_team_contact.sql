-- ============================================================
-- Care team contact details
-- ============================================================
-- A phone number and an email per care team member, so the Team page can offer Call and Email.
-- Both default to empty: a member without them simply shows no Call or Email action.

ALTER TABLE public.care_team_members ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.care_team_members ADD COLUMN email TEXT NOT NULL DEFAULT '';
