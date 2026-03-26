-- schema for Scope Pilot

create extension if not exists "pgcrypto";

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  website text,
  logo_url text,
  default_proposal_tone text,
  default_exclusions text,
  default_terms text,
  default_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text,
  email text unique,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists walkthroughs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  created_by_user_id uuid references users(id) on delete set null,
  client_name text,
  client_email text,
  property_name text,
  property_type text,
  square_footage integer,
  number_of_floors integer,
  service_frequency text,
  occupancy_notes text,
  special_requirements text,
  typed_notes text,
  status text default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists walkthrough_assets (
  id uuid primary key default gen_random_uuid(),
  walkthrough_id uuid references walkthroughs(id) on delete cascade,
  asset_type text not null check (asset_type in ('audio','photo','doc')),
  file_url text not null,
  mime_type text,
  file_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists walkthrough_transcripts (
  id uuid primary key default gen_random_uuid(),
  walkthrough_id uuid references walkthroughs(id) on delete cascade,
  source_asset_id uuid references walkthrough_assets(id) on delete set null,
  transcript_text text not null,
  provider text,
  created_at timestamptz not null default now()
);

create table if not exists extracted_walkthroughs (
  id uuid primary key default gen_random_uuid(),
  walkthrough_id uuid unique references walkthroughs(id) on delete cascade,
  property_summary jsonb not null default '{}'::jsonb,
  areas jsonb not null default '[]'::jsonb,
  sitewide_requirements jsonb not null default '[]'::jsonb,
  floor_care_notes jsonb not null default '[]'::jsonb,
  restroom_notes jsonb not null default '[]'::jsonb,
  trash_notes jsonb not null default '[]'::jsonb,
  security_access_notes jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  clarification_questions jsonb not null default '[]'::jsonb,
  extraction_confidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bid_packages (
  id uuid primary key default gen_random_uuid(),
  walkthrough_id uuid references walkthroughs(id) on delete cascade,
  version_number integer not null default 1,
  scope_text text,
  checklist_json jsonb not null default '[]'::jsonb,
  proposal_text text,
  followup_email_text text,
  internal_questions_text text,
  status text default 'generated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_presets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  preset_name text not null,
  proposal_style text,
  default_exclusions text,
  default_assumptions text,
  default_email_style text,
  default_service_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists generation_logs (
  id uuid primary key default gen_random_uuid(),
  walkthrough_id uuid references walkthroughs(id) on delete cascade,
  step_name text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  model_name text,
  status text,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
