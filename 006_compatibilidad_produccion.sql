-- 006 - Compatibilidad completa de la app y bootstrap seguro con Supabase Auth
alter table public.empresas add column if not exists ctas_puente jsonb not null default '{}'::jsonb;

alter table public.usuarios add column if not exists departamento_id text;
alter table public.usuarios add column if not exists ubicacion_id text;
alter table public.usuarios add column if not exists cuenta_banco text;
alter table public.usuarios add column if not exists aprobador_id uuid;
alter table public.usuarios add column if not exists permisos_extra jsonb not null default '{}'::jsonb;

alter table public.expedientes add column if not exists pedido_id text;
alter table public.expedientes add column if not exists nota_tesoreria text;
alter table public.expedientes add column if not exists monto_cruce_contra numeric(14,2) default 0;
alter table public.expedientes add column if not exists monto_cruce_reemb numeric(14,2) default 0;
alter table public.expedientes add column if not exists pagado_por text;
alter table public.expedientes add column if not exists en_tesoreria boolean not null default false;
alter table public.expedientes add column if not exists fecha_envio_tesoreria date;
alter table public.expedientes add column if not exists enviado_por_tesoreria text;
alter table public.expedientes add column if not exists descuento_aplicado boolean not null default false;
alter table public.expedientes add column if not exists fecha_descuento_nomina date;
alter table public.expedientes add column if not exists descuento_confirmado_por text;
alter table public.expedientes add column if not exists folio_poliza text;
alter table public.expedientes add column if not exists fecha_contabilizacion date;
alter table public.expedientes add column if not exists contabilizado_por text;
alter table public.expedientes add column if not exists en_rh boolean not null default false;
alter table public.expedientes add column if not exists fecha_envio_rh date;
alter table public.expedientes add column if not exists enviado_rh_por text;
alter table public.expedientes add column if not exists motivo_cancelacion text;
alter table public.expedientes drop constraint if exists expedientes_estado_check;
alter table public.expedientes add constraint expedientes_estado_check check (estado in ('CAPTURA','ENVIADA','APROBADA','RECHAZADA','COMPROBACION','COMP_REVISION','CERRADA','CANCELADA'));

alter table public.movimientos add column if not exists es_comision boolean not null default false;
alter table public.movimientos add column if not exists monto_comprobado numeric(14,2) default 0;
alter table public.movimientos add column if not exists aprobado boolean not null default false;

alter table public.tickets add column if not exists departamento text;

create or replace function private.mi_empresa_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.empresa_id from public.usuarios u
  where coalesce(u.auth_user_id, u.id) = (select auth.uid()) and u.activo is true limit 1
$$;
create or replace function private.mi_rol() returns text
language sql stable security definer set search_path = '' as $$
  select u.rol from public.usuarios u
  where coalesce(u.auth_user_id, u.id) = (select auth.uid()) and u.activo is true limit 1
$$;

create or replace function private.crear_perfil_inicial() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid;
  v_rol text;
  v_nombre text;
begin
  perform pg_advisory_xact_lock(7349201);
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    insert into public.empresas(nombre, rfc) values ('GBSOLUTION', null) returning id into v_empresa;
  end if;
  if exists(select 1 from public.usuarios) then v_rol := 'Empleado'; else v_rol := 'Administrador'; end if;
  v_nombre := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  insert into public.usuarios(id, auth_user_id, empresa_id, empresa_nombre, nombre, correo, rol, activo)
  values(new.id, new.id, v_empresa, 'GBSOLUTION', v_nombre, lower(new.email), v_rol, true)
  on conflict(correo) do update set auth_user_id=excluded.auth_user_id, id=excluded.id, actualizado_en=now();
  return new;
end $$;
revoke all on function private.crear_perfil_inicial() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_gastos on auth.users;
create trigger on_auth_user_created_gastos after insert on auth.users
for each row execute function private.crear_perfil_inicial();

-- Permitir que cada usuario lea su perfil incluso durante la carga inicial.
drop policy if exists usuarios_lectura on public.usuarios;
create policy usuarios_lectura on public.usuarios for select to authenticated
using (empresa_id=(select private.mi_empresa_id()) or coalesce(auth_user_id,id)=(select auth.uid()));

-- Las secuencias de auditoría se usan bajo RLS.
grant usage, select on sequence public.auditoria_eventos_id_seq to authenticated;
