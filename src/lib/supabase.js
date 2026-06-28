import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente do Supabase não configuradas.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
)

/*
======================================================
  SQL COMPLETO — cole no Supabase SQL Editor e clique Run
======================================================

create table if not exists professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null, role text not null, initials text not null,
  color text default 'purple', active boolean default true,
  photo_url text, bio text, created_at timestamptz default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null,
  duration_min int not null, price numeric not null,
  active boolean default true, created_at timestamptz default now()
);

create table if not exists professional_services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  custom_price numeric, unique(professional_id, service_id)
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null default '', phone text unique not null,
  email text, notes text, otp text, otp_expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  service_id uuid references services(id),
  professional_id uuid references professionals(id),
  date date not null, time time not null, price_charged numeric,
  status text default 'confirmed', notes text, code text unique,
  reminder_sent boolean default false,
  rating int check (rating >= 1 and rating <= 5),
  review text, reviewed_at timestamptz, created_at timestamptz default now()
);

create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  date date not null, time time, reason text, all_day boolean default false
);

create table if not exists working_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time time, close_time time, is_open boolean default true,
  unique(day_of_week)
);

create table if not exists salon_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, value text not null
);

create table if not exists salon_gallery (
  id uuid primary key default gen_random_uuid(),
  url text not null, caption text,
  order_index int default 0, active boolean default true,
  created_at timestamptz default now()
);

-- Dados iniciais
insert into working_hours (day_of_week, open_time, close_time, is_open) values
  (0,null,null,false),(1,'08:00','18:00',true),(2,'08:00','18:00',true),
  (3,'08:00','18:00',true),(4,'08:00','18:00',true),
  (5,'08:00','18:00',true),(6,'08:00','17:00',true)
on conflict (day_of_week) do nothing;

insert into salon_settings (key, value) values
  ('salon_name','Meu Salão'),('salon_phone',''),('salon_address',''),
  ('whatsapp_api_url',''),('whatsapp_api_key',''),('whatsapp_instance',''),
  ('admin_whatsapp',''),('reminder_enabled','false'),
  ('reminder_hours_before','24'),
  ('reminder_message','Olá {nome}! Lembrete: *{servico}* com {profissional} em {data} às {horario}. Até lá! 😊'),
  ('notify_admin_new_booking','false'),
  ('notify_admin_message','📅 Novo agendamento!\n👤 {nome} ({telefone})\n✂️ {servico} com {profissional}\n📆 {data} às {horario}\n💰 R$ {valor}'),
  ('commission_enabled','false'),('commission_pct','40'),
  ('admin_password_hash','salon2024'),
  ('logo_url',''),('primary_color','#042C53'),
  ('secondary_color','#185FA5'),('accent_color','#B5D4F4')
on conflict (key) do nothing;

-- RLS
alter table appointments enable row level security;
alter table clients enable row level security;
alter table professional_services enable row level security;
alter table blocked_slots enable row level security;
alter table working_hours enable row level security;
alter table salon_settings enable row level security;
alter table salon_gallery enable row level security;
alter table professionals enable row level security;
alter table services enable row level security;

drop policy if exists "public_all" on appointments;
drop policy if exists "public_all_clients" on clients;
drop policy if exists "public_ps" on professional_services;
drop policy if exists "public_blocked" on blocked_slots;
drop policy if exists "public_hours" on working_hours;
drop policy if exists "public_settings" on salon_settings;
drop policy if exists "public_gallery" on salon_gallery;
drop policy if exists "public_all_professionals" on professionals;
drop policy if exists "public_all_services" on services;

create policy "public_all" on appointments using (true) with check (true);
create policy "public_all_clients" on clients using (true) with check (true);
create policy "public_ps" on professional_services using (true) with check (true);
create policy "public_blocked" on blocked_slots using (true) with check (true);
create policy "public_hours" on working_hours using (true) with check (true);
create policy "public_settings" on salon_settings using (true) with check (true);
create policy "public_gallery" on salon_gallery using (true) with check (true);
create policy "public_all_professionals" on professionals using (true) with check (true);
create policy "public_all_services" on services using (true) with check (true);

-- Storage buckets (execute separadamente se der erro)
insert into storage.buckets (id, name, public) values ('professionals','professionals',true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('logos','logos',true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('gallery','gallery',true) on conflict do nothing;

drop policy if exists "public_upload_prof" on storage.objects;
drop policy if exists "public_read_prof" on storage.objects;
create policy "public_read_prof" on storage.objects for select using (bucket_id in ('professionals','logos','gallery'));
create policy "public_upload_prof" on storage.objects for insert with check (bucket_id in ('professionals','logos','gallery'));

======================================================
*/
