-- 004: columna para gastos rechazados en Clara
alter table movimientos add column if not exists es_rechazado boolean default false;
