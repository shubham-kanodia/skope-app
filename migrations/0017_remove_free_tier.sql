-- Remove the free tier. Skope is now paid-only: no free plan, no trial. A new
-- org is read-only until it subscribes (plan_active_until in the past).
--
-- Postgres can't cleanly drop an enum value, so we keep 'free' in the org_plan
-- enum but stop using it: existing free orgs become Starter, the column default
-- becomes 'starter', and signup code sets plan_active_until in the past.

-- Existing free orgs → Starter with a 30-day grace window so they aren't locked
-- out the moment payments go live. After that they lapse to read-only ("inactive")
-- until they subscribe.
update orgs
   set plan = 'starter',
       plan_active_until = now() + interval '30 days'
 where plan = 'free';

-- Revoke launch-offer comp (non-founding orgs). Legacy founding members keep theirs.
update orgs
   set comp_until = null
 where is_founding_member = false;

-- New orgs default to the entry tier; signup sets plan_active_until in the past.
alter table orgs alter column plan set default 'starter';
