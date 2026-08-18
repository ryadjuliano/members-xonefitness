-- Full reset — wipes everything this project creates (tables, functions,
-- trigger, storage bucket + its objects, and every migrated member's auth
-- account) so you can re-run 0001_init.sql + `npm run migrate` from a truly
-- clean slate. Safe to run repeatedly. Does NOT touch other Supabase
-- projects or any staff/admin auth users outside this app.

drop trigger if exists on_auth_member_created on auth.users;
drop function if exists handle_new_member_user();
drop function if exists current_member_id();
drop function if exists is_member();

drop table if exists check_ins cascade;
drop table if exists payments cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists members cascade;
drop table if exists products cascade;
drop table if exists product_categories cascade;
drop table if exists stores cascade;

delete from storage.objects where bucket_id = 'payment-proofs';
delete from storage.buckets where id = 'payment-proofs';

delete from auth.users where email like '%@members.xonefitness.local';
