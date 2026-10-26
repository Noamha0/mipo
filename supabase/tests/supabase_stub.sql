-- ============================================================
-- מדמה את מה ש-Supabase מספק לפני המיגרציות, כדי להריץ אותן
-- מקומית ב-PGlite: סכמת auth, auth.uid() מתוך ה-JWT, תפקידי
-- anon/authenticated, וברירות המחדל של ההרשאות בסכמת public.
-- ============================================================

create schema auth;

create table auth.users (
  id     uuid primary key,
  phone  text
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
$$;

create role anon nologin;
create role authenticated nologin;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
