create or replace function public.incrementar_usos_cupom(p_cupom_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cupons
  set usos = usos + 1
  where id = p_cupom_id;
$$;
