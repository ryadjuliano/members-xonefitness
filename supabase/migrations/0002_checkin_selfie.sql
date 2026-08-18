-- Check-in flow: QR scan (validated against stores.code) + a selfie photo
-- taken right after a successful check-in. Adds the column that holds the
-- selfie's Storage path and the private bucket it lives in.

alter table check_ins add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('checkin-selfies', 'checkin-selfies', false)
on conflict (id) do nothing;

drop policy if exists "members can read own checkin selfies" on storage.objects;
create policy "members can read own checkin selfies" on storage.objects for select
  using (bucket_id = 'checkin-selfies' and is_member());

drop policy if exists "members can upload own checkin selfies" on storage.objects;
create policy "members can upload own checkin selfies" on storage.objects for insert
  with check (bucket_id = 'checkin-selfies' and is_member());
