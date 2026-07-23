-- 003: columna para retiros de efectivo Clara
alter table movimientos add column if not exists es_retiro boolean default false;
