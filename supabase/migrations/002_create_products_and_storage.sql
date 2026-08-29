-- ==========================================================
-- Migration 002: Products, Multi-Photo Product Scans & Secure Storage
-- ==========================================================

-- 1. Create Products Table (Unique product catalog entries)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  brand_name text not null,
  commodity_name text not null,
  barcode_number text,
  created_at timestamptz default now()
);

-- 2. Create Product Scans Table (Historical scan timeline per product)
create table if not exists product_scans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  batch_number text,
  checklist_results jsonb not null,
  photo_urls text[] not null default '{}',
  response_time_ms integer,
  created_at timestamptz default now()
);

-- 3. Enable Row Level Security (RLS)
alter table products enable row level security;
alter table product_scans enable row level security;

-- 4. RLS Policies for Products Table
create policy "Users manage their own products"
  on products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. RLS Policies for Product Scans Table
create policy "Users manage their own product scans"
  on product_scans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. Storage Bucket & Strict Per-User Storage RLS
-- Create product-photos private storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

-- Enable RLS on storage.objects (if not already enabled)
alter table storage.objects enable row level security;

-- Storage Policy: Users can only upload photos to their own user_id folder
-- Path convention: {user_id}/{product_scan_id}/{filename}
create policy "Users can upload their own product photos"
  on storage.objects for insert
  with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: Users can only view/read photos in their own user_id folder
create policy "Users can view their own product photos"
  on storage.objects for select
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: Users can only update photos in their own user_id folder
create policy "Users can update their own product photos"
  on storage.objects for update
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: Users can only delete photos in their own user_id folder
create policy "Users can delete their own product photos"
  on storage.objects for delete
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
