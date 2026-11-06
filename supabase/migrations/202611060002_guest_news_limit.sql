begin;

create function public.giro_guest_post_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select post.id from public.posts post join public.channels channel on channel.id=post.channel_id
  where post.status='published' and channel.status='active'
  order by post.published_at desc, post.id desc limit 5;
$$;
revoke all on function public.giro_guest_post_ids() from public;
grant execute on function public.giro_guest_post_ids() to anon, authenticated;

drop policy "posts publicados públicos" on public.posts;
create policy "cinco últimas notícias para visitantes" on public.posts for select to anon
using (id in (select public.giro_guest_post_ids()));
create policy "notícias para leitores autenticados" on public.posts for select to authenticated
using ((status='published' and exists(select 1 from public.channels where id=channel_id and status='active')) or public.has_role(auth.uid(),'admin'));

revoke select on public.posts from anon;
grant select (id,slug,channel_id,title,summary,image_key,image_alt,is_urgent,is_demo,published_at,city,state,tags,likes_count,comments_count,status) on public.posts to anon;

drop policy "comentários publicados" on public.comments;
create policy "comentários para leitores autenticados" on public.comments for select to authenticated
using (removed_at is null and (parent_id is null or public.giro_comment_visible(parent_id))
  and exists(select 1 from public.posts post join public.channels channel on channel.id=post.channel_id where post.id=post_id and post.status='published' and channel.status='active'));

revoke execute on function public.giro_comments(uuid,integer,text), public.giro_comment_visible(uuid), public.giro_public_profile(text) from anon;

notify pgrst, 'reload schema';
commit;
