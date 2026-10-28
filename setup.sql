-- Run this SQL in Supabase Dashboard > SQL Editor.
-- Then create a Supabase Auth user for the administrator and assign role='admin'
-- using the SQL below. Never expose the service_role key in the website.

create extension if not exists pgcrypto;

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  site_name text not null default 'Tutorial Video',
  site_title text not null default 'শিখুন নিজের গতিতে',
  site_description text not null default 'আপনার প্রতিষ্ঠানের টিউটোরিয়াল ভিডিও এক জায়গায়। ভিডিও দেখতে অ্যাকাউন্ট লাগবে না।',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  video_url text not null,
  storage_path text,
  thumbnail_url text,
  published boolean not null default true,
  views bigint not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists videos_published_created_idx on public.videos (published, created_at desc);

alter table public.site_settings enable row level security;
alter table public.user_roles enable row level security;
alter table public.videos enable row level security;

-- Helper checks the signed-in user's admin role. SECURITY DEFINER avoids recursive RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy "Anyone can read site settings" on public.site_settings
  for select to anon, authenticated using (true);
create policy "Admins can insert site settings" on public.site_settings
  for insert to authenticated with check (public.is_admin());
create policy "Admins can update site settings" on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read published videos" on public.videos
  for select to anon, authenticated using (published = true or public.is_admin());
create policy "Admins can insert videos" on public.videos
  for insert to authenticated with check (public.is_admin());
create policy "Admins can update videos" on public.videos
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete videos" on public.videos
  for delete to authenticated using (public.is_admin());

-- Public view counter: atomic increment. It only increments an existing published video.
create or replace function public.increment_video_view(video_id_input uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare new_count bigint;
begin
  update public.videos
  set views = views + 1
  where id = video_id_input and published = true
  returning views into new_count;
  if new_count is null then
    raise exception 'Video not found or not published';
  end if;
  return new_count;
end;
$$;
revoke all on function public.increment_video_view(uuid) from public;
grant execute on function public.increment_video_view(uuid) to anon, authenticated;

-- Storage bucket: public playback; only admins can upload/update/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutorial-videos', 'tutorial-videos', true, 209715200, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 209715200,
  allowed_mime_types = array['video/mp4','video/webm','video/quicktime'];

create policy "Public can read tutorial videos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'tutorial-videos');
create policy "Admins can upload tutorial videos" on storage.objects
  for insert to authenticated with check (bucket_id = 'tutorial-videos' and public.is_admin());
create policy "Admins can update tutorial videos" on storage.objects
  for update to authenticated using (bucket_id = 'tutorial-videos' and public.is_admin())
  with check (bucket_id = 'tutorial-videos' and public.is_admin());
create policy "Admins can delete tutorial videos" on storage.objects
  for delete to authenticated using (bucket_id = 'tutorial-videos' and public.is_admin());

-- IMPORTANT: after creating the first admin user in Supabase Authentication > Users,
-- replace USER_UUID below with that user's UUID and run this statement:
-- insert into public.user_roles (user_id, role) values ('USER_UUID', 'admin')
-- on conflict (user_id) do update set role = 'admin';
