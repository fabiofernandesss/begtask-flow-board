-- Create trigger to automatically add default columns to a new board
-- This avoids frontend race conditions and guarantees baseline columns

create or replace function public.create_default_columns_for_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Avoid duplicates if columns already exist (e.g., created by frontend)
  if not exists (
    select 1 from public.columns c where c.board_id = new.id
  ) then
    insert into public.columns (board_id, titulo, posicao)
    values
      (new.id, 'Em andamento', 0),
      (new.id, 'Concluídas', 1);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_default_columns on public.boards;
create trigger trg_create_default_columns
after insert on public.boards
for each row
execute function public.create_default_columns_for_board();