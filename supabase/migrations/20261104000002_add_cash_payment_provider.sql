alter table payments drop constraint if exists payments_provider_check;

alter table payments
  add constraint payments_provider_check
  check (provider in ('SIMULATION', 'FACTUS_PAY', 'CASH'));
