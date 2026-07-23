-- ================================================================
-- 002 — MIGRACIÓN: adaptar schema a la app actual
-- Ejecutar en SQL Editor de Supabase DESPUÉS de 001 (o solo, si 001 ya corrió)
-- Es idempotente: se puede correr varias veces sin daño
-- ================================================================

-- 1. usuarios: quitar FK a auth.users (el login es propio de la app, no Supabase Auth)
alter table usuarios drop constraint if exists usuarios_id_fkey;

-- 2. usuarios: permitir rol RH
alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check
  check (rol in ('Administrador','Aprobador','Contador','RH','Empleado'));

-- 3. usuarios: columna para nombre de empresa (denormalizado, usado por la app)
alter table usuarios add column if not exists empresa_nombre text;

-- 4. empresas: cierre de período
alter table empresas add column if not exists fecha_corte date;

-- 5. expedientes: saldos en contra
alter table expedientes add column if not exists saldo_estado text;
alter table expedientes add column if not exists saldo_metodo text;
alter table expedientes add column if not exists saldo_fecha_recuperacion date;

-- 6. movimientos: campos completos del CFDI y diferencias
alter table movimientos add column if not exists iva16 numeric(12,2) default 0;
alter table movimientos add column if not exists iva8 numeric(12,2) default 0;
alter table movimientos add column if not exists iva_retenido numeric(12,2) default 0;
alter table movimientos add column if not exists isr_retenido numeric(12,2) default 0;
alter table movimientos add column if not exists ish numeric(12,2) default 0;
alter table movimientos add column if not exists propina numeric(12,2) default 0;
alter table movimientos add column if not exists tipo_diferencia text;
alter table movimientos add column if not exists rfc_emisor text;
alter table movimientos add column if not exists emisor text;

-- 7. tickets: ligar a expediente
alter table tickets add column if not exists folio_solicitud text;
alter table tickets add column if not exists solicitud_id uuid;
alter table tickets add column if not exists autor_nombre text;
alter table tickets drop constraint if exists tickets_autor_id_fkey;
alter table tickets drop constraint if exists tickets_asignado_id_fkey;

-- 8. expedientes: quitar FKs a usuarios (ids se manejan en la app)
alter table expedientes drop constraint if exists expedientes_solicitante_id_fkey;
alter table expedientes drop constraint if exists expedientes_autorizador_id_fkey;

-- 9. RLS: DESACTIVAR por ahora — el login es de la app, no Supabase Auth,
--    así que auth.uid() siempre es null y las políticas bloquearían todo.
--    (Cuando migremos a Supabase Auth se reactiva con políticas correctas)
alter table empresas       disable row level security;
alter table usuarios       disable row level security;
alter table expedientes    disable row level security;
alter table movimientos    disable row level security;
alter table tickets        disable row level security;
alter table notificaciones disable row level security;

-- Listo. Verificación rápida:
select 'empresas' as tabla, count(*) from empresas
union all select 'usuarios', count(*) from usuarios
union all select 'expedientes', count(*) from expedientes;
