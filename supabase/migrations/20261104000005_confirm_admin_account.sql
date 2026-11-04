-- Existing accounts do not always inherit changes made to Auth confirmation settings.
update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where lower(coalesce(email, '')) = 'admin@factqr.com';
