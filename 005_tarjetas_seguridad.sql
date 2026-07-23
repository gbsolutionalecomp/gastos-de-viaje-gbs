-- 005 - Tarjetas, cortes y seguridad multiempresa
-- Aplicar en un entorno de prueba después de 001-004. Requiere Supabase Auth.
create extension if not exists pgcrypto;

alter table public.usuarios add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios add constraint usuarios_rol_check check (rol in ('Administrador','Aprobador','Contador','Tesorería','RH','Empleado'));

create table if not exists public.tarjetas_corporativas (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  alias text not null, emisor text not null, ultimos4 text not null check (ultimos4 ~ '^[0-9]{4}$'),
  titular text not null, moneda text not null default 'MXN', activa boolean not null default true,
  creada_por uuid references auth.users(id), creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  unique (empresa_id, emisor, ultimos4)
);
create table if not exists public.sesiones_tarjeta (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  tarjeta_id uuid not null references public.tarjetas_corporativas(id) on delete restrict, nombre text not null,
  fecha_inicio date not null, fecha_fin date not null, fecha_corte date, fecha_limite_pago date,
  total_estado_cuenta numeric(14,2) not null default 0, estado text not null default 'abierta' check (estado in ('abierta','en_revision','conciliada','cerrada')),
  creada_por uuid references auth.users(id), cerrado_por uuid references auth.users(id), creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio), unique (tarjeta_id, fecha_inicio, fecha_fin)
);
create table if not exists public.transacciones_tarjeta (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  sesion_id uuid not null references public.sesiones_tarjeta(id) on delete restrict, proveedor_id text, proveedor_nombre text,
  fecha date not null, comercio text not null, monto numeric(14,2) not null, moneda text not null default 'MXN', referencia text,
  clara_id text, origen text not null default 'manual' check (origen in ('manual','archivo_clara','api_clara')),
  payload_hash text, estado_conciliacion text not null default 'pendiente' check (estado_conciliacion in ('pendiente','comprobada','observada')),
  creada_por uuid references auth.users(id), creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  unique (empresa_id, clara_id), unique (empresa_id, payload_hash)
);
create table if not exists public.comprobantes_transaccion (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  transaccion_id uuid not null references public.transacciones_tarjeta(id) on delete restrict,
  uuid_cfdi text not null, rfc_emisor text not null, rfc_receptor text, emisor text, subtotal numeric(14,2), total numeric(14,2) not null,
  iva numeric(14,2) not null default 0, retenciones numeric(14,2) not null default 0,
  storage_path text not null, nombre_archivo text not null, hash_archivo text not null,
  creado_por uuid references auth.users(id), creado_en timestamptz not null default now(),
  unique (empresa_id, uuid_cfdi), unique (empresa_id, hash_archivo)
);
create table if not exists public.lotes_exportacion_contable (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  folio text not null, formato text not null default 'TXT_INTERNO', desde date, hasta date,
  total_debe numeric(14,2) not null, total_haber numeric(14,2) not null,
  estado text not null default 'generado' check (estado in ('generado','validado','cancelado')),
  hash_archivo text not null, creado_por uuid references auth.users(id), creado_en timestamptz not null default now(),
  unique (empresa_id, folio), check (abs(total_debe-total_haber) < 0.01)
);
create table if not exists public.auditoria_eventos (
  id bigint generated always as identity primary key, empresa_id uuid not null references public.empresas(id) on delete restrict,
  actor_id uuid references auth.users(id), entidad text not null, entidad_id text not null, accion text not null,
  datos jsonb not null default '{}'::jsonb, creado_en timestamptz not null default now()
);

create index if not exists idx_tarjetas_empresa on public.tarjetas_corporativas(empresa_id);
create index if not exists idx_sesiones_tarjeta on public.sesiones_tarjeta(tarjeta_id, fecha_inicio desc);
create index if not exists idx_transacciones_sesion on public.transacciones_tarjeta(sesion_id, fecha);
create index if not exists idx_comprobantes_transaccion on public.comprobantes_transaccion(transaccion_id);
create index if not exists idx_auditoria_empresa_fecha on public.auditoria_eventos(empresa_id, creado_en desc);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
create or replace function private.mi_empresa_id() returns uuid language sql stable security definer set search_path = '' as $$
  select u.empresa_id from public.usuarios u where u.auth_user_id = (select auth.uid()) and u.activo is true limit 1
$$;
create or replace function private.mi_rol() returns text language sql stable security definer set search_path = '' as $$
  select u.rol from public.usuarios u where u.auth_user_id = (select auth.uid()) and u.activo is true limit 1
$$;
revoke all on function private.mi_empresa_id() from public, anon;
revoke all on function private.mi_rol() from public, anon;
grant execute on function private.mi_empresa_id(), private.mi_rol() to authenticated;

alter table public.empresas enable row level security;
alter table public.usuarios enable row level security;
alter table public.expedientes enable row level security;
alter table public.movimientos enable row level security;
alter table public.tickets enable row level security;
alter table public.notificaciones enable row level security;
alter table public.tarjetas_corporativas enable row level security;
alter table public.sesiones_tarjeta enable row level security;
alter table public.transacciones_tarjeta enable row level security;
alter table public.comprobantes_transaccion enable row level security;
alter table public.lotes_exportacion_contable enable row level security;
alter table public.auditoria_eventos enable row level security;

-- Elimina políticas históricas amplias antes de instalar las políticas autorizadas.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename in
  ('empresas','usuarios','expedientes','movimientos','tickets','notificaciones','tarjetas_corporativas','sesiones_tarjeta','transacciones_tarjeta','comprobantes_transaccion','lotes_exportacion_contable','auditoria_eventos')
  loop execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename); end loop;
end $$;

create policy empresa_lectura on public.empresas for select to authenticated using (id=(select private.mi_empresa_id()));
create policy empresa_admin on public.empresas for update to authenticated using (id=(select private.mi_empresa_id()) and (select private.mi_rol())='Administrador') with check (id=(select private.mi_empresa_id()));
create policy usuarios_lectura on public.usuarios for select to authenticated using (empresa_id=(select private.mi_empresa_id()));
create policy usuarios_admin on public.usuarios for all to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol())='Administrador') with check (empresa_id=(select private.mi_empresa_id()));
create policy expedientes_lectura on public.expedientes for select to authenticated using (empresa_id=(select private.mi_empresa_id()) and ((select private.mi_rol()) in ('Administrador','Aprobador','Contador','Tesorería','RH') or solicitante_id=(select auth.uid())));
create policy expedientes_escritura on public.expedientes for all to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol()) in ('Administrador','Aprobador','Contador','Tesorería')) with check (empresa_id=(select private.mi_empresa_id()));
create policy movimientos_acceso on public.movimientos for all to authenticated using (exists(select 1 from public.expedientes e where e.id=expediente_id and e.empresa_id=(select private.mi_empresa_id()))) with check (exists(select 1 from public.expedientes e where e.id=expediente_id and e.empresa_id=(select private.mi_empresa_id())));
create policy tickets_acceso on public.tickets for all to authenticated using (empresa_id=(select private.mi_empresa_id())) with check (empresa_id=(select private.mi_empresa_id()));
create policy notificaciones_contabilidad on public.notificaciones for all to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol()) in ('Administrador','Contador')) with check (empresa_id=(select private.mi_empresa_id()));

create policy tarjetas_lectura on public.tarjetas_corporativas for select to authenticated using (empresa_id=(select private.mi_empresa_id()));
create policy tarjetas_gestion on public.tarjetas_corporativas for all to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol()) in ('Administrador','Contador','Tesorería')) with check (empresa_id=(select private.mi_empresa_id()));
create policy sesiones_lectura on public.sesiones_tarjeta for select to authenticated using (empresa_id=(select private.mi_empresa_id()));
create policy sesiones_gestion on public.sesiones_tarjeta for all to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol()) in ('Administrador','Contador','Tesorería')) with check (empresa_id=(select private.mi_empresa_id()));
create policy transacciones_lectura on public.transacciones_tarjeta for select to authenticated using (empresa_id=(select private.mi_empresa_id()));
create policy transacciones_gestion on public.transacciones_tarjeta for all to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol()) in ('Administrador','Contador','Tesorería')) with check (empresa_id=(select private.mi_empresa_id()));
create policy comprobantes_lectura on public.comprobantes_transaccion for select to authenticated using (empresa_id=(select private.mi_empresa_id()));
create policy comprobantes_gestion on public.comprobantes_transaccion for all to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol()) in ('Administrador','Contador')) with check (empresa_id=(select private.mi_empresa_id()));
create policy lotes_contabilidad on public.lotes_exportacion_contable for all to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol()) in ('Administrador','Contador')) with check (empresa_id=(select private.mi_empresa_id()));
create policy auditoria_lectura on public.auditoria_eventos for select to authenticated using (empresa_id=(select private.mi_empresa_id()) and (select private.mi_rol())='Administrador');
create policy auditoria_insert on public.auditoria_eventos for insert to authenticated with check (empresa_id=(select private.mi_empresa_id()) and actor_id=(select auth.uid()));

insert into storage.buckets(id,name,public) values ('archivos-expedientes','archivos-expedientes',false) on conflict(id) do update set public=false;
drop policy if exists archivos_empresa_select on storage.objects;
drop policy if exists archivos_empresa_insert on storage.objects;
drop policy if exists archivos_empresa_update on storage.objects;
drop policy if exists archivos_empresa_delete on storage.objects;
create policy archivos_empresa_select on storage.objects for select to authenticated using (bucket_id='archivos-expedientes' and (storage.foldername(name))[1]=(select private.mi_empresa_id())::text);
create policy archivos_empresa_insert on storage.objects for insert to authenticated with check (bucket_id='archivos-expedientes' and (storage.foldername(name))[1]=(select private.mi_empresa_id())::text);
create policy archivos_empresa_update on storage.objects for update to authenticated using (bucket_id='archivos-expedientes' and (storage.foldername(name))[1]=(select private.mi_empresa_id())::text) with check (bucket_id='archivos-expedientes' and (storage.foldername(name))[1]=(select private.mi_empresa_id())::text);
create policy archivos_empresa_delete on storage.objects for delete to authenticated using (bucket_id='archivos-expedientes' and (storage.foldername(name))[1]=(select private.mi_empresa_id())::text and (select private.mi_rol()) in ('Administrador','Contador'));

grant select,insert,update,delete on public.tarjetas_corporativas,public.sesiones_tarjeta,public.transacciones_tarjeta,public.comprobantes_transaccion,public.lotes_exportacion_contable to authenticated;
grant select,insert on public.auditoria_eventos to authenticated;
revoke all on all tables in schema public from anon;
