create table if not exists public.bookings (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,
  booking_id text not null references public.bookings(id),
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;
alter table public.payments enable row level security;
