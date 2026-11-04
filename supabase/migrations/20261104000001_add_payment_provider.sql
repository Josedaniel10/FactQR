alter table payments
  add column if not exists provider text not null default 'SIMULATION'
  check (provider in ('SIMULATION', 'FACTUS_PAY', 'CASH'));
