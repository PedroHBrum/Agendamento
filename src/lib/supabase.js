import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ Variáveis de ambiente do Supabase não configuradas.\n' +
    'Crie um arquivo .env.local com REACT_APP_SUPABASE_URL e REACT_APP_SUPABASE_ANON_KEY.\n' +
    'No Vercel, adicione essas variáveis em Settings → Environment Variables.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
)

/*
======================================================
  COLE ESSE SQL NO PAINEL DO SUPABASE (SQL Editor)
  Vá em: SQL Editor → New query → cole tudo abaixo → Run
======================================================

-- Profissionais
create table if not exists professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null, role text not null, initials text not null,
  color text default 'purple', active boolean default true,
  created_at timestamptz default now()
);

-- Serviços
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null,
  duration_min int not null, price numeric not null,
  active boolean default true, created_at timestamptz default now()
);

-- Vínculo profissional <-> serviço com preço próprio
create table if not exists professional_services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  custom_price numeric, unique(professional_id, service_id)
);

-- Clientes
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null default '', phone text unique not null,
  email text, birthdate date, notes text,
  otp text, otp_expires_at timestamptz, created_at timestamptz default now()
);

-- Agendamentos
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  service_id uuid references services(id),
  professional_id uuid references professionals(id),
  date date not null, time time not null, price_charged numeric,
  status text default 'confirmed', notes text, code text unique,
  reminder_sent boolean default false,
  rating int check (rating >= 1 and rating <= 5),
  review text, reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Horários bloqueados
create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  date date not null, time time, reason text, all_day boolean default false
);

-- Configurações do salão
create table if not exists salon_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, value text not null
);

-- Horários de funcionamento
create table if not exists working_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time time, close_time time, is_open boolean default true,
  unique(day_of_week)
);

-- Dados iniciais de exemplo (remova ou adapte)
insert into professionals (name, role, initials, color) values
  ('Ana Lima','Cabelereira','AL','purple'),
  ('Carla Souza','Esteticista / Depiladora','CS','pink'),
  ('Fernanda Costa','Manicure','FC','teal'),
  ('Juliana Ramos','Polivalente','JR','amber')
on conflict do nothing;

insert into services (name, category, duration_min, price) values
  ('Corte feminino','Cabelo',45,60),('Corte masculino','Cabelo',30,40),
  ('Escova progressiva','Cabelo',180,180),('Coloração','Cabelo',120,120),
  ('Depilação perna inteira','Depilação',60,80),('Depilação buço','Depilação',15,20),
  ('Depilação axilas','Depilação',20,30),('Depilação virilha','Depilação',30,50),
  ('Manicure','Unhas',40,35),('Pedicure','Unhas',50,40),
  ('Sobrancelha (design)','Sobrancelha',30,30),
  ('Limpeza de pele','Estética',90,90),('Massagem relaxante','Massagem',60,100)
on conflict do nothing;

insert into working_hours (day_of_week, open_time, close_time, is_open) values
  (0,null,null,false),(1,'08:00','18:00',true),(2,'08:00','18:00',true),
  (3,'08:00','18:00',true),(4,'08:00','18:00',true),
  (5,'08:00','18:00',true),(6,'08:00','17:00',true)
on conflict do nothing;

insert into salon_settings (key, value) values
  ('salon_name','Meu Salão'),('salon_phone',''),('salon_address',''),
  ('whatsapp_api_url',''),('whatsapp_api_key',''),('whatsapp_instance',''),
  ('admin_whatsapp',''),
  ('reminder_enabled','false'),
  ('reminder_hours_before','24'),
  ('reminder_message','Olá {nome}! Lembrete: você tem *{servico}* com {profissional} em {data} às {horario}. Até lá! 😊'),
  ('notify_admin_new_booking','false'),
  ('notify_admin_message','📅 Novo agendamento!\n👤 {nome} ({telefone})\n✂️ {servico} com {profissional}\n📆 {data} às {horario}\n💰 R$ {valor}'),
  ('commission_enabled','false'),
  ('commission_pct','40'),
  ('admin_password_hash','salon2024'),
  ('logo_url',''),
  ('primary_color','#042C53'),
  ('secondary_color','#185FA5'),
  ('accent_color','#B5D4F4')
on conflict (key) do nothing;

-- RLS (Row Level Security)
alter table appointments enable row level security;
alter table clients enable row level security;
alter table professional_services enable row level security;
alter table blocked_slots enable row level security;
alter table working_hours enable row level security;
alter table salon_settings enable row level security;

-- Políticas de acesso público (ajuste para produção se necessário)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='appointments' and policyname='public_all') then
    create policy "public_all" on appointments using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='clients' and policyname='public_all_clients') then
    create policy "public_all_clients" on clients using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='professional_services' and policyname='public_ps') then
    create policy "public_ps" on professional_services using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='blocked_slots' and policyname='public_blocked') then
    create policy "public_blocked" on blocked_slots using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='working_hours' and policyname='public_hours') then
    create policy "public_hours" on working_hours using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='salon_settings' and policyname='public_settings') then
    create policy "public_settings" on salon_settings using (true) with check (true);
  end if;
end $$;

======================================================
  EDGE FUNCTION — Lembretes automáticos
  Supabase → Edge Functions → New Function → "send-reminders"
======================================================

Cole este código no arquivo index.ts da Edge Function:

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { data: settings } = await supabase.from('salon_settings').select('key,value')
  const cfg = Object.fromEntries((settings||[]).map(r=>[r.key,r.value]))
  if (cfg.reminder_enabled !== 'true') return new Response('Lembretes desativados')
  const hoursB = parseInt(cfg.reminder_hours_before || '24')
  const targetDate = new Date(Date.now() + hoursB*3600*1000).toISOString().slice(0,10)
  const { data: appts } = await supabase.from('appointments')
    .select('*, clients(name,phone), services(name), professionals(name)')
    .eq('date', targetDate).eq('status','confirmed').eq('reminder_sent', false)
  let sent = 0
  for (const ap of (appts||[])) {
    const d = new Date(ap.date+'T12:00:00')
    const msg = (cfg.reminder_message||'')
      .replace('{nome}', ap.clients?.name||'')
      .replace('{servico}', ap.services?.name||'')
      .replace('{profissional}', ap.professionals?.name||'')
      .replace('{horario}', ap.time?.slice(0,5)||'')
      .replace('{data}', `${d.getDate()}/${d.getMonth()+1}`)
    if (cfg.whatsapp_api_url) {
      await fetch(`${cfg.whatsapp_api_url}/message/sendText/${cfg.whatsapp_instance}`, {
        method:'POST', headers:{'apikey':cfg.whatsapp_api_key,'Content-Type':'application/json'},
        body:JSON.stringify({number:`55${ap.clients?.phone}`,text:msg})
      })
    }
    await supabase.from('appointments').update({reminder_sent:true}).eq('id',ap.id)
    sent++
  }
  return new Response(`Lembretes enviados: ${sent}`)
})

Para agendar automaticamente, vá em Database → Extensions → ative pg_cron, depois:
select cron.schedule('send-reminders', '0 8 * * *',
  $$select net.http_post(url:='https://SEU_PROJETO.supabase.co/functions/v1/send-reminders',
    headers:='{"Authorization":"Bearer SUA_ANON_KEY"}'::jsonb)$$);

======================================================
*/
