-- OPTEX — Storage buckets + policies
-- Public buckets: product-images, tryon-assets, promo-banners (CDN-cacheable).
-- Private bucket: prescriptions (signed URLs only, admin or owner).

insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', true),
  ('tryon-assets',   'tryon-assets',   true),
  ('promo-banners',  'promo-banners',  true),
  ('prescriptions',  'prescriptions',  false)
on conflict (id) do nothing;

-- Public buckets: anyone reads, only admin writes.
create policy "public reads product images"
  on storage.objects for select using (bucket_id = 'product-images');

create policy "admin writes product images"
  on storage.objects for insert with check (bucket_id = 'product-images' and is_super_admin());
create policy "admin updates product images"
  on storage.objects for update using (bucket_id = 'product-images' and is_super_admin());
create policy "admin deletes product images"
  on storage.objects for delete using (bucket_id = 'product-images' and is_super_admin());

create policy "public reads tryon assets"
  on storage.objects for select using (bucket_id = 'tryon-assets');
create policy "admin manages tryon assets"
  on storage.objects for all
  using      (bucket_id = 'tryon-assets' and is_super_admin())
  with check (bucket_id = 'tryon-assets' and is_super_admin());

create policy "public reads banners"
  on storage.objects for select using (bucket_id = 'promo-banners');
create policy "admin manages banners"
  on storage.objects for all
  using      (bucket_id = 'promo-banners' and is_super_admin())
  with check (bucket_id = 'promo-banners' and is_super_admin());

-- Prescriptions: owner or admin only.
-- Convention: object path = '<customer_id>/<filename>' so we can match owner via path prefix.
create policy "owner reads own prescription"
  on storage.objects for select using (
    bucket_id = 'prescriptions'
    and (
      is_super_admin()
      or (storage.foldername(name))[1] = current_customer_id()::text
    )
  );

create policy "owner uploads own prescription"
  on storage.objects for insert with check (
    bucket_id = 'prescriptions'
    and (storage.foldername(name))[1] = current_customer_id()::text
  );

create policy "admin manages prescriptions"
  on storage.objects for all
  using      (bucket_id = 'prescriptions' and is_super_admin())
  with check (bucket_id = 'prescriptions' and is_super_admin());
