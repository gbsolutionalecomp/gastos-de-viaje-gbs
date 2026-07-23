-- ================================================================
-- GASTOS DE VIAJE — Schema inicial Supabase
-- Ejecutar en el SQL Editor de tu proyecto Supabase
-- ================================================================

-- Habilitar UUID
create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────
-- EMPRESAS
-- ──────────────────────────────────────────
create table empresas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  rfc           text,
  logo_url      text,                    -- URL en Supabase Storage
  catalogo      jsonb default '[]',      -- cuentas contables
  mapa          jsonb default '{}',      -- mapeo general categoría→cuenta
  politicas     jsonb default '{}',      -- límites por rol
  centros_costos jsonb default '[]',
  ubicaciones   jsonb default '[]',
  departamentos jsonb default '[]',      -- incluye mapa propio y cc
  proyectos     jsonb default '[]',      -- incluye pedidos
  correo_notificacion text,
  correo_cc     text,
  creado_en     timestamptz default now(),
  actualizado_en timestamptz default now()
);

-- ──────────────────────────────────────────
-- USUARIOS (extiende auth.users de Supabase)
-- ──────────────────────────────────────────
create table usuarios (
  id              uuid primary key references auth.users(id) on delete cascade,
  empresa_id      uuid references empresas(id),
  nombre          text not null,
  correo          text not null unique,
  rol             text not null default 'Empleado'
                  check (rol in ('Administrador','Aprobador','Contador','Empleado')),
  departamento    text,
  departamento_id text,
  ubicacion       text,
  ubicacion_id    text,
  cc              text,
  -- Datos bancarios para reembolso
  banco           text,
  clabe           text,
  cuenta_banco    text,
  titular_cuenta  text,
  rfc             text,
  activo          boolean default true,
  creado_en       timestamptz default now(),
  actualizado_en  timestamptz default now()
);

-- ──────────────────────────────────────────
-- EXPEDIENTES (solicitudes + reembolsos + caja chica)
-- ──────────────────────────────────────────
create table expedientes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id),
  solicitante_id  uuid references usuarios(id),
  folio           text not null unique,
  tipo            text not null default 'viaje'
                  check (tipo in ('viaje','reembolso','caja-chica')),
  estado          text not null default 'CAPTURA'
                  check (estado in ('CAPTURA','ENVIADA','APROBADA','COMPROBACION','RECHAZADA','CERRADA')),
  -- Datos del proyecto
  proyecto        text,
  proyecto_id     text,                  -- FK lógica a proyectos en jsonb
  pedido          text,
  pedido_id       text,
  cliente         text,
  objetivo        text,
  -- Logística
  solicitante     text,
  departamento    text,
  departamento_id text,
  ubicacion       text,
  cc              text,
  encargado       text,
  origen          text,
  destino         text,
  fecha_inicio    date,
  fecha_fin       date,
  fecha_solicitud date default current_date,
  -- Financiero
  monto_clara     numeric(12,2) default 0,
  fondo_efectivo  numeric(12,2) default 0,
  presupuesto     jsonb default '{}',    -- {Transporte: 1000, Alimentos: 500, ...}
  -- Aprobación
  autorizador     text,
  autorizador_id  uuid references usuarios(id),
  fecha_aprobacion timestamptz,
  fecha_pago      date,
  -- Datos bancarios snapshot al momento de crear el reembolso
  datos_bancarios jsonb default '{}',
  -- Historial de cambios
  historial       jsonb default '[]',
  -- Timestamps
  creado_en       timestamptz default now(),
  actualizado_en  timestamptz default now()
);

-- ──────────────────────────────────────────
-- MOVIMIENTOS (gastos dentro de un expediente)
-- ──────────────────────────────────────────
create table movimientos (
  id              uuid primary key default gen_random_uuid(),
  expediente_id   uuid not null references expedientes(id) on delete cascade,
  origen          text not null default 'manual'
                  check (origen in ('clara','clara-reembolso','manual')),
  fecha           date not null,
  concepto        text not null,
  categoria       text,
  cuenta_contable text,
  subtotal        numeric(12,2),
  iva             numeric(12,2) default 0,
  total           numeric(12,2) not null,
  factura         boolean default false,
  uuid_cfdi       text,
  forma_pago      text,
  reembolso       boolean default false,
  aprobacion_clara text,
  comentario_clara text,
  -- Archivo adjunto (XML/PDF guardado en Storage)
  archivo_url     text,
  archivo_nombre  text,
  creado_en       timestamptz default now()
);

-- ──────────────────────────────────────────
-- TICKETS DE SOPORTE
-- ──────────────────────────────────────────
create table tickets (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id),
  autor_id        uuid references usuarios(id),
  folio           text not null unique,
  asunto          text not null,
  descripcion     text,
  categoria       text,
  prioridad       text default 'Media'
                  check (prioridad in ('Alta','Media','Baja')),
  estado          text default 'Abierto'
                  check (estado in ('Abierto','En proceso','Resuelto','Cerrado')),
  asignado_id     uuid references usuarios(id),
  asignado_nombre text,
  comentarios     jsonb default '[]',
  historial       jsonb default '[]',
  creado_en       timestamptz default now(),
  actualizado_en  timestamptz default now()
);

-- ──────────────────────────────────────────
-- NOTIFICACIONES (para correos pendientes)
-- ──────────────────────────────────────────
create table notificaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid references empresas(id),
  expediente_id   uuid references expedientes(id),
  tipo            text not null,         -- 'aprobacion_pendiente','aprobado','rechazado','reembolso_listo'
  destinatario    text not null,         -- correo
  cc              text,
  asunto          text,
  cuerpo          text,
  enviado         boolean default false,
  enviado_en      timestamptz,
  error           text,
  creado_en       timestamptz default now()
);

-- ──────────────────────────────────────────
-- ÍNDICES
-- ──────────────────────────────────────────
create index idx_expedientes_empresa on expedientes(empresa_id);
create index idx_expedientes_solicitante on expedientes(solicitante_id);
create index idx_expedientes_estado on expedientes(estado);
create index idx_expedientes_fecha on expedientes(fecha_solicitud);
create index idx_movimientos_expediente on movimientos(expediente_id);
create index idx_tickets_empresa on tickets(empresa_id);
create index idx_notificaciones_enviado on notificaciones(enviado) where not enviado;

-- ──────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────
alter table empresas        enable row level security;
alter table usuarios        enable row level security;
alter table expedientes     enable row level security;
alter table movimientos     enable row level security;
alter table tickets         enable row level security;
alter table notificaciones  enable row level security;

-- Función helper: obtener empresa_id del usuario actual
create or replace function mi_empresa_id()
returns uuid language sql security definer as $$
  select empresa_id from usuarios where id = auth.uid()
$$;

-- Función helper: obtener rol del usuario actual
create or replace function mi_rol()
returns text language sql security definer as $$
  select rol from usuarios where id = auth.uid()
$$;

-- POLÍTICAS: usuarios ven datos de su empresa
create policy "usuarios_su_empresa" on usuarios
  for all using (empresa_id = mi_empresa_id());

create policy "expedientes_su_empresa" on expedientes
  for select using (
    empresa_id = mi_empresa_id() and (
      mi_rol() in ('Administrador','Aprobador','Contador')
      or solicitante_id = auth.uid()
    )
  );

create policy "expedientes_insert" on expedientes
  for insert with check (empresa_id = mi_empresa_id() and solicitante_id = auth.uid());

create policy "expedientes_update" on expedientes
  for update using (
    empresa_id = mi_empresa_id() and (
      mi_rol() in ('Administrador','Aprobador')
      or (solicitante_id = auth.uid() and estado in ('CAPTURA','RECHAZADA'))
    )
  );

create policy "movimientos_su_expediente" on movimientos
  for all using (
    expediente_id in (select id from expedientes where empresa_id = mi_empresa_id())
  );

create policy "tickets_su_empresa" on tickets
  for all using (empresa_id = mi_empresa_id());

create policy "empresas_su_empresa" on empresas
  for select using (id = mi_empresa_id());

create policy "empresas_admin_update" on empresas
  for update using (id = mi_empresa_id() and mi_rol() = 'Administrador');

-- ──────────────────────────────────────────
-- TRIGGER: actualizar updated_at automáticamente
-- ──────────────────────────────────────────
create or replace function actualizar_timestamp()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger tr_expedientes_updated
  before update on expedientes
  for each row execute function actualizar_timestamp();

create trigger tr_usuarios_updated
  before update on usuarios
  for each row execute function actualizar_timestamp();

create trigger tr_empresas_updated
  before update on empresas
  for each row execute function actualizar_timestamp();

-- ──────────────────────────────────────────
-- STORAGE BUCKETS
-- ──────────────────────────────────────────
-- Ejecutar en Supabase Dashboard > Storage:
-- 1. Crear bucket "logos-empresas" (público)
-- 2. Crear bucket "archivos-expedientes" (privado)
-- 3. Crear bucket "reportes-pdf" (privado)
