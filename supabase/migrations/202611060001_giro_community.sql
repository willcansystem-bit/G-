begin;

alter table public.profiles add column show_location boolean not null default false;
drop policy "perfis públicos" on public.profiles;
revoke select on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy "perfil privado" on public.profiles for select to authenticated using (id = auth.uid());

create function public.giro_staff() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor');
$$;
create function public.giro_roles() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('admin', public.has_role(auth.uid(), 'admin'), 'staff', public.giro_staff());
$$;
create function public.giro_profile() returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(profile) from public.profiles profile where id = auth.uid();
$$;
create function public.giro_public_profile(p_username text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('display_name',display_name,'username',username,'avatar_url',avatar_url,'bio',bio,'city',case when show_location then city end,'state',case when show_location then state end)
  from public.profiles where username=lower(p_username);
$$;
create function public.giro_save_profile(p_data jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if char_length(p_data->>'display_name') > 80 or char_length(p_data->>'bio') > 500 or char_length(p_data->>'city') > 100 then raise exception 'Perfil inválido'; end if;
  if coalesce(p_data->>'username','') !~ '^[a-zA-Z0-9_]{3,30}$' then raise exception 'Nome de usuário: use de 3 a 30 letras, números ou sublinhados'; end if;
  if jsonb_array_length(coalesce(p_data->'interests','[]')) > 30 then raise exception 'Limite de interesses excedido'; end if;
  update public.profiles set display_name = nullif(trim(p_data->>'display_name'),''), username = lower(p_data->>'username'),
    bio = nullif(trim(p_data->>'bio'),''), city = nullif(trim(p_data->>'city'),''), state = nullif(p_data->>'state',''),
    interests = array(select jsonb_array_elements_text(coalesce(p_data->'interests','[]'))), show_location = coalesce((p_data->>'show_location')::boolean, false)
  where id = auth.uid();
end; $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "avatars leitura pública" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars criar próprio" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars excluir próprio" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create function public.giro_avatar(p_path text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if p_path is not null and (split_part(p_path,'/',1) <> auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='avatars' and name=p_path)) then raise exception 'Imagem inválida'; end if;
  update public.profiles set avatar_url = p_path where id = auth.uid();
end; $$;
revoke update on public.profiles from authenticated;
revoke insert on public.profiles from authenticated;

alter table public.comments add column removed_at timestamptz;
create function public.giro_comment_visible(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  with recursive ancestors as (
    select id, parent_id, removed_at, post_id from public.comments where id = p_id
    union all select parent.id, parent.parent_id, parent.removed_at, parent.post_id from public.comments parent join ancestors child on parent.id = child.parent_id
  ) select exists(select 1 from ancestors) and not exists(select 1 from ancestors where removed_at is not null)
    and exists(select 1 from public.posts post join public.channels channel on channel.id=post.channel_id where post.id=(select post_id from ancestors limit 1) and post.status='published' and channel.status='active');
$$;
drop policy "comentários públicos" on public.comments;
create policy "comentários publicados" on public.comments for select using (
  removed_at is null and (parent_id is null or public.giro_comment_visible(parent_id))
  and exists(select 1 from public.posts post join public.channels channel on channel.id=post.channel_id where post.id=post_id and post.status='published' and channel.status='active')
);
drop policy "comentar" on public.comments;
create policy "comentar publicação pública" on public.comments for insert to authenticated with check (
  auth.uid() = user_id and removed_at is null and exists(select 1 from public.posts post join public.channels channel on channel.id=post.channel_id where post.id=post_id and post.status='published' and channel.status='active')
  and (parent_id is null or public.giro_comment_visible(parent_id))
);
drop policy "seguir" on public.channel_follows;
create policy "seguir canal oficial ativo" on public.channel_follows for insert to authenticated with check (
  user_id=auth.uid() and exists(select 1 from public.channels where id=channel_id and status='active')
);
create function public.giro_validate_comment() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.parent_id is not null and not exists(select 1 from public.comments where id=new.parent_id and post_id=new.post_id) then raise exception 'Resposta inválida'; end if;
  if tg_op = 'UPDATE' and not public.giro_staff() then new.removed_at := old.removed_at; end if;
  return new;
end; $$;
create trigger validate_comment before insert or update on public.comments for each row execute function public.giro_validate_comment();
create function public.giro_comments(p_post uuid, p_offset integer default 0, p_order text default 'asc') returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(result)), '[]') from (
    select comment.id, comment.body, comment.created_at, comment.is_edited, comment.parent_id, comment.user_id,
      profile.display_name, profile.avatar_url, profile.username
    from public.comments comment join public.profiles profile on profile.id=comment.user_id
    where comment.post_id=p_post and public.giro_comment_visible(comment.id)
    order by case when p_order='desc' then comment.created_at end desc, case when p_order<>'desc' then comment.created_at end asc, comment.id
    limit 30 offset greatest(0, p_offset)
  ) result;
$$;

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(), comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, reason text not null check(char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now(), resolved_at timestamptz, unique(comment_id,user_id)
);
alter table public.comment_reports enable row level security;
create function public.giro_report(p_comment uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.giro_comment_visible(p_comment) then raise exception 'Ação indisponível'; end if;
  insert into public.comment_reports(comment_id,user_id,reason) values(p_comment,auth.uid(),p_reason) on conflict(comment_id,user_id) do nothing;
end; $$;
create function public.giro_reports(p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.giro_staff() then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (select report.id,report.comment_id,report.reason,report.created_at,comment.body from public.comment_reports report join public.comments comment on comment.id=report.comment_id where resolved_at is null order by report.created_at,report.id limit 30 offset greatest(p_offset,0)) result);
end; $$;
create function public.giro_moderate(p_report uuid, p_remove boolean) returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if not public.giro_staff() then raise exception 'Acesso negado' using errcode='42501'; end if;
  select comment_id into target from public.comment_reports where id=p_report;
  if p_remove then update public.comments set removed_at=now() where id=target; end if;
  update public.comment_reports set resolved_at=now() where comment_id=target;
end; $$;

create table public.team_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  subject text not null check(subject in ('Sugestão de pauta','Correção de notícia','Suporte','Parceria','Outro')),
  status text not null default 'pending' check(status in ('pending','in_progress','resolved')),
  updated_at timestamptz not null default now()
);
create table public.team_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade, body text not null check(char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(), read_at timestamptz
);
create index team_messages_thread on public.team_messages(conversation_id, created_at, id);
alter table public.team_conversations enable row level security;
alter table public.team_messages enable row level security;
grant select on public.team_conversations, public.team_messages to authenticated;
create policy "própria conversa ou equipe" on public.team_conversations for select to authenticated using(user_id=auth.uid() or public.giro_staff());
create policy "próprias mensagens ou equipe" on public.team_messages for select to authenticated using(exists(select 1 from public.team_conversations where id=conversation_id and (user_id=auth.uid() or public.giro_staff())));
create function public.giro_send(p_body text, p_subject text default 'Outro', p_conversation uuid default null) returns uuid language plpgsql security definer set search_path = public as $$
declare conversation uuid;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if p_conversation is not null then
    select id into conversation from public.team_conversations where id=p_conversation and (user_id=auth.uid() or public.giro_staff()) for update;
    if conversation is null then raise exception 'Acesso negado' using errcode='42501'; end if;
  else
    insert into public.team_conversations(user_id,subject) values(auth.uid(),p_subject)
    on conflict(user_id) do update set subject=excluded.subject returning id into conversation;
  end if;
  insert into public.team_messages(conversation_id,sender_id,body) values(conversation,auth.uid(),trim(p_body));
  update public.team_conversations set updated_at=now(), status=case when public.giro_staff() and user_id<>auth.uid() then 'in_progress' else 'pending' end where id=conversation;
  return conversation;
end; $$;
create function public.giro_inbox(p_search text default '', p_status text default '', p_offset integer default 0, p_own boolean default false) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (
    select conversation.*, profile.display_name,
      (select count(*) from public.team_messages message where message.conversation_id=conversation.id and message.read_at is null and case when public.giro_staff() and conversation.user_id<>auth.uid() then message.sender_id=conversation.user_id else message.sender_id<>conversation.user_id end) as unread
    from public.team_conversations conversation join public.profiles profile on profile.id=conversation.user_id
    where (conversation.user_id=auth.uid() or (not p_own and public.giro_staff())) and (p_status='' or conversation.status=p_status)
    and (coalesce(profile.display_name,'') ilike '%'||p_search||'%' or conversation.subject ilike '%'||p_search||'%')
    order by conversation.updated_at desc, conversation.id limit 30 offset greatest(0,p_offset)
  ) result);
end; $$;
create function public.giro_thread(p_conversation uuid, p_offset integer default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.team_conversations where id=p_conversation and (user_id=auth.uid() or public.giro_staff());
  if owner_id is null then raise exception 'Acesso negado' using errcode='42501'; end if;
  update public.team_messages set read_at=now() where id in (
    select id from public.team_messages where conversation_id=p_conversation
    order by created_at desc,id desc limit 30 offset greatest(p_offset,0)
  ) and read_at is null and case when owner_id=auth.uid() then sender_id<>owner_id else sender_id=owner_id end;
  return (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (select * from public.team_messages where conversation_id=p_conversation order by created_at desc,id desc limit 30 offset greatest(p_offset,0)) result);
end; $$;
create function public.giro_unread() returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.team_messages message join public.team_conversations conversation on conversation.id=message.conversation_id
  where message.read_at is null and (conversation.user_id=auth.uid() or public.giro_staff())
  and case when conversation.user_id=auth.uid() then message.sender_id<>conversation.user_id else message.sender_id=conversation.user_id end;
$$;
create function public.giro_status(p_conversation uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.giro_staff() then raise exception 'Acesso negado' using errcode='42501'; end if;
  update public.team_conversations set status=p_status where id=p_conversation;
end; $$;

create table public.follower_events (
  id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade, delta integer not null check(delta in (-1,1)), created_at timestamptz not null default now()
);
alter table public.follower_events enable row level security;
insert into public.follower_events(user_id,channel_id,delta) select user_id,channel_id,1 from public.channel_follows where user_id in (select id from auth.users);
create function public.giro_follow_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op='INSERT' then insert into public.follower_events(user_id,channel_id,delta) values(new.user_id,new.channel_id,1);
  else insert into public.follower_events(user_id,channel_id,delta) select old.user_id,old.channel_id,-1 where exists(select 1 from auth.users where id=old.user_id); end if;
  return null;
end; $$;
create trigger giro_follow_history after insert or delete on public.channel_follows for each row execute function public.giro_follow_event();
create table public.daily_activity (user_id uuid not null references auth.users(id) on delete cascade, day date not null default current_date, primary key(user_id,day));
alter table public.daily_activity enable row level security;
create function public.giro_activity() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then insert into public.daily_activity(user_id) values(auth.uid()) on conflict do nothing; end if;
end; $$;
create function public.giro_metrics(p_from date, p_to date, p_channel uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ranked_posts jsonb;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_from>p_to then raise exception 'Período inválido'; end if;
  with stats as (
    select post.id,post.title,
      (select count(*) from public.post_likes where post_id=post.id and created_at>=p_from and created_at<p_to+1) as likes,
      (select count(*) from public.comments where post_id=post.id and public.giro_comment_visible(id) and created_at>=p_from and created_at<p_to+1) as comments,
      (select count(*) from public.saved_posts where post_id=post.id and created_at>=p_from and created_at<p_to+1) as saves
    from public.posts post where p_channel is null or channel_id=p_channel
  ), ranked as (
    select *,row_number() over(order by likes desc,id) as like_rank,row_number() over(order by comments desc,id) as comment_rank,row_number() over(order by saves desc,id) as save_rank from stats
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'likes',likes,'comments',comments,'saves',saves)),'[]') into ranked_posts from ranked where like_rank<=20 or comment_rank<=20 or save_rank<=20;
  return jsonb_build_object(
    'total', (select count(*) from auth.users),
    'new_users', (select count(*) from auth.users where created_at>=p_from and created_at<p_to+1),
    'active', (select count(distinct user_id) from public.daily_activity where day between p_from and p_to and (p_channel is null or exists(select 1 from public.channel_follows where channel_id=p_channel and user_id=daily_activity.user_id))),
    'followers', (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (select channel.id,channel.name,(select count(*) from public.channel_follows where channel_id=channel.id) as followers,coalesce((select sum(delta) from public.follower_events where channel_id=channel.id and created_at>=p_from and created_at<p_to+1),0) as growth from public.channels channel where p_channel is null or channel.id=p_channel order by growth desc,channel.name) result),
    'evolution', (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (select created_at::date as day,channel_id,sum(delta) as net_change from public.follower_events where created_at>=p_from and created_at<p_to+1 and (p_channel is null or channel_id=p_channel) group by created_at::date,channel_id order by day,channel_id) result),
    'history_since', (select min(created_at) from public.follower_events),
    'posts', ranked_posts,
    'cities', (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (select coalesce(city,'Não informado') as label,count(*) as total from public.profiles where p_channel is null or exists(select 1 from public.channel_follows where channel_id=p_channel and user_id=profiles.id) group by city order by total desc) result),
    'states', (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (select coalesce(state,'Não informado') as label,count(*) as total from public.profiles where p_channel is null or exists(select 1 from public.channel_follows where channel_id=p_channel and user_id=profiles.id) group by state order by total desc) result),
    'interests', (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (select interest as label,count(*) as total from public.profiles cross join lateral unnest(case when cardinality(interests)=0 then array['Não informado'] else interests end) interest where p_channel is null or exists(select 1 from public.channel_follows where channel_id=p_channel and user_id=profiles.id) group by interest order by total desc) result)
  );
end; $$;
create function public.giro_users(p_filters jsonb default '{}', p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (
    select profile.id,profile.display_name,account.email,profile.city,profile.state,profile.interests,account.created_at,
      case when account.banned_until>now() then 'Suspensa' when account.email_confirmed_at is null then 'Aguardando confirmação' else 'Ativa' end as status,
      (select coalesce(jsonb_agg(channel.name),'[]') from public.channel_follows follow join public.channels channel on channel.id=follow.channel_id where follow.user_id=profile.id) as channels
    from public.profiles profile join auth.users account on account.id=profile.id
    where (coalesce(profile.display_name,'') ilike '%'||coalesce(p_filters->>'q','')||'%' or account.email ilike '%'||coalesce(p_filters->>'q','')||'%')
    and (coalesce(p_filters->>'city','')='' or profile.city ilike '%'||(p_filters->>'city')||'%')
    and (coalesce(p_filters->>'state','')='' or profile.state=p_filters->>'state')
    and (coalesce(p_filters->>'interest','')='' or exists(select 1 from unnest(profile.interests) interest where interest ilike '%'||(p_filters->>'interest')||'%'))
    and (coalesce(p_filters->>'channel','')='' or exists(select 1 from public.channel_follows where user_id=profile.id and channel_id::text=p_filters->>'channel'))
    order by account.created_at desc,profile.id limit 30 offset greatest(p_offset,0)
  ) result);
end; $$;

grant all on public.comment_reports, public.team_conversations, public.team_messages, public.follower_events, public.daily_activity to service_role;
do $$ declare routine record; begin
  for routine in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'giro_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', routine.signature);
    execute format('grant execute on function %s to authenticated', routine.signature);
  end loop;
end; $$;
grant execute on function public.giro_comments(uuid,integer,text), public.giro_comment_visible(uuid), public.giro_public_profile(text) to anon;

notify pgrst, 'reload schema';
commit;
