-- Create scans table for Legal Metrology analysis history
create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  response_time_ms integer,
  priority_fields jsonb not null,
  additional_findings jsonb not null
);

-- Enable Row Level Security (RLS)
alter table scans enable row level security;

-- Policy: Users can only view their own scans
create policy "Users can view their own scans"
  on scans for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own scans
create policy "Users can insert their own scans"
  on scans for insert
  with check (auth.uid() = user_id);
