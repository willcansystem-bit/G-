create type public.app_role as enum ('admin','editor','reader');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  avatar_url text,
  bio text,
  city text,
  state text,
  interests text[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "perfis públicos" on public.profiles for select using (true);
create policy "editar próprio perfil" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "criar próprio perfil" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create policy "ver próprios papéis" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'reader');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  color text not null default '#FF6A00',
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active','hidden','archived')),
  followers_count int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.channels to anon, authenticated;
grant all on public.channels to service_role;
alter table public.channels enable row level security;
create policy "canais ativos públicos" on public.channels for select using (status = 'active' or public.has_role(auth.uid(),'admin'));

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text not null,
  subtitle text,
  summary text not null,
  body text not null default '',
  image_key text,
  image_alt text,
  image_credit text,
  author_name text not null default 'Redação Giro+',
  tags text[] not null default '{}',
  is_urgent boolean not null default false,
  is_featured boolean not null default false,
  is_demo boolean not null default true,
  city text,
  state text,
  recipe jsonb,
  sources jsonb not null default '[]',
  status text not null default 'published' check (status in ('draft','published','archived')),
  likes_count int not null default 0,
  comments_count int not null default 0,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_published_idx on public.posts (published_at desc) where status = 'published';
create index posts_channel_idx on public.posts (channel_id, published_at desc);
grant select on public.posts to anon, authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts publicados públicos" on public.posts for select using (status = 'published' or public.has_role(auth.uid(),'admin'));

create table public.channel_follows (
  user_id uuid not null,
  channel_id uuid not null references public.channels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);
grant select, insert, delete on public.channel_follows to authenticated;
grant all on public.channel_follows to service_role;
alter table public.channel_follows enable row level security;
create policy "ver próprios seguidos" on public.channel_follows for select to authenticated using (auth.uid() = user_id);
create policy "seguir" on public.channel_follows for insert to authenticated with check (auth.uid() = user_id);
create policy "deixar de seguir" on public.channel_follows for delete to authenticated using (auth.uid() = user_id);

create table public.post_likes (
  user_id uuid not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
grant select, insert, delete on public.post_likes to authenticated;
grant all on public.post_likes to service_role;
alter table public.post_likes enable row level security;
create policy "ver próprias curtidas" on public.post_likes for select to authenticated using (auth.uid() = user_id);
create policy "curtir" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "descurtir" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

create table public.saved_posts (
  user_id uuid not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
grant select, insert, delete on public.saved_posts to authenticated;
grant all on public.saved_posts to service_role;
alter table public.saved_posts enable row level security;
create policy "ver próprios salvos" on public.saved_posts for select to authenticated using (auth.uid() = user_id);
create policy "salvar" on public.saved_posts for insert to authenticated with check (auth.uid() = user_id);
create policy "remover salvo" on public.saved_posts for delete to authenticated using (auth.uid() = user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_edited boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at desc);
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comentários públicos" on public.comments for select using (true);
create policy "comentar" on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "editar próprio comentário" on public.comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "excluir próprio comentário" on public.comments for delete to authenticated using (auth.uid() = user_id);

create or replace function public.bump_counts() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end;
  pid uuid; cid uuid;
begin
  if tg_table_name = 'post_likes' or tg_table_name = 'comments' then
    pid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
  end if;
  if tg_table_name = 'post_likes' then
    update public.posts set likes_count = greatest(0, likes_count + d) where id = pid;
  elsif tg_table_name = 'comments' then
    update public.posts set comments_count = greatest(0, comments_count + d) where id = pid;
  elsif tg_table_name = 'channel_follows' then
    cid := case when tg_op = 'INSERT' then new.channel_id else old.channel_id end;
    update public.channels set followers_count = greatest(0, followers_count + d) where id = cid;
  end if;
  return null;
end; $$;
create trigger likes_count after insert or delete on public.post_likes for each row execute function public.bump_counts();
create trigger comments_count after insert or delete on public.comments for each row execute function public.bump_counts();
create trigger follows_count after insert or delete on public.channel_follows for each row execute function public.bump_counts();

create or replace function public.mark_comment_edited() returns trigger language plpgsql set search_path = public as $$
begin new.is_edited := true; new.post_id := old.post_id; new.user_id := old.user_id; new.parent_id := old.parent_id; new.created_at := old.created_at; return new; end; $$;
create trigger comment_edited before update on public.comments for each row execute function public.mark_comment_edited();

insert into public.channels (slug,name,description,color,sort_order) values
('saude','G+ Saúde','Saúde, bem-estar e qualidade de vida.','#22C55E',1),
('cidades','G+ Cidades','Notícias locais, serviços e mobilidade.','#0EA5E9',2),
('politica','G+ Política','Governo, políticas públicas e eleições.','#EF4444',3),
('receitas','G+ Receitas','Culinária e receitas práticas.','#F59E0B',4),
('brasil','G+ Brasil','Acontecimentos nacionais.','#16A34A',5),
('mundo','G+ Mundo','Notícias internacionais.','#3B82F6',6),
('economia','G+ Economia','Economia, negócios e educação financeira.','#10B981',7),
('tecnologia','G+ Tecnologia','Tecnologia, inovação e inteligência artificial.','#FF6A00',8),
('esportes','G+ Esportes','Modalidades, competições e resultados.','#84CC16',9),
('cultura','G+ Cultura','Cinema, música, arte e entretenimento.','#EC4899',10),
('educacao','G+ Educação','Ensino, oportunidades e conhecimento.','#6366F1',11),
('meio-ambiente','G+ Meio Ambiente','Clima, sustentabilidade e natureza.','#059669',12);

insert into public.posts (slug, channel_id, title, subtitle, summary, body, image_key, image_alt, tags, is_urgent, is_featured, city, state, recipe, published_at)
select v.slug, c.id, v.title, v.subtitle, v.summary, v.body, v.image_key, v.image_alt, v.tags::text[], v.urgent, v.featured, v.city, v.state, v.recipe::jsonb, now() - (v.hrs::numeric * interval '1 hour')
from (values
('demo-caminhada-diaria','saude','Como incluir caminhadas curtas na rotina','Guia prático de exemplo','Conteúdo demonstrativo: dicas simples para transformar pequenos intervalos do dia em minutos de movimento.',E'Este é um texto demonstrativo criado para apresentar o Giro+.\n\nPequenas caminhadas ao longo do dia podem ser uma forma acessível de se movimentar. Comece com cinco minutos após as refeições e aumente gradualmente.\n\nConsulte sempre um profissional de saúde antes de mudar sua rotina de exercícios.','saude','Legumes, frutas e um estetoscópio sobre a mesa','{bem-estar,exercício}',false,true,null,null,null,'1'),
('demo-hidratacao-calor','saude','Hidratação nos dias quentes: o básico','Exemplo editorial','Conteúdo demonstrativo sobre hábitos de hidratação, escrito para ilustrar o formato de notícias de saúde.',E'Texto demonstrativo.\n\nManter uma garrafa de água por perto e observar sinais do corpo são hábitos simples. Frutas ricas em água também ajudam.','saude','Alimentos frescos sobre mesa de madeira','{verão,hábitos}',false,false,null,null,null,'20'),
('demo-ciclofaixa-centro','cidades','Exemplo: nova ciclofaixa conecta bairros ao centro','Notícia fictícia para demonstração','Publicação demonstrativa que ilustra como o G+ Cidades apresenta mudanças de mobilidade urbana.',E'Este conteúdo é fictício e serve apenas para demonstrar o Giro+.\n\nA notícia de exemplo descreve uma ciclofaixa que liga bairros residenciais à região central, com integração aos corredores de ônibus.','cidades','Avenida com ciclofaixa e ônibus ao entardecer','{mobilidade,bicicleta}',false,true,'São Paulo','SP',null,'2'),
('demo-horario-onibus','cidades','Exemplo: linhas de ônibus terão horário estendido','Notícia fictícia','Conteúdo demonstrativo sobre serviços públicos e transporte em uma cidade fictícia.','Texto demonstrativo. Em um cenário de exemplo, linhas noturnas passam a circular até mais tarde nos fins de semana.','cidades','Ônibus em avenida urbana','{transporte,serviços}',true,false,'Belo Horizonte','MG',null,'5'),
('demo-consulta-publica','politica','Exemplo: como funciona uma consulta pública','Explicador demonstrativo','Conteúdo demonstrativo que explica, de forma geral, como cidadãos podem participar de consultas públicas.',E'Texto demonstrativo.\n\nConsultas públicas são mecanismos de participação em que a população pode enviar contribuições sobre propostas. Este explicador é ilustrativo.',null,null,'{participação,cidadania}',false,false,null,null,null,'3'),
('demo-orcamento-participativo','politica','Exemplo: o que é orçamento participativo','Explicador demonstrativo','Conteúdo demonstrativo sobre um modelo de participação popular na definição de prioridades de investimento.','Texto demonstrativo explicando, de forma genérica, o conceito de orçamento participativo.',null,null,'{orçamento,gestão pública}',false,false,null,null,null,'30'),
('demo-prato-feito-caseiro','receitas','Prato feito caseiro em 40 minutos','Receita demonstrativa','Arroz, feijão, salada e um bife temperado: uma receita de exemplo para mostrar o formato do G+ Receitas.','Receita demonstrativa criada para o Giro+.','receitas','Prato com arroz, feijão, bife, farofa e salada','{almoço,brasileira}',false,true,null,null,'{"rendimento":"2 porções","tempo":"40 minutos","ingredientes":["1 xícara de arroz","2 conchas de feijão cozido","2 bifes","Alface, tomate e cebola roxa","Sal, alho e azeite"],"preparo":["Refogue o alho no azeite e cozinhe o arroz.","Aqueça o feijão com um pouco de alho.","Tempere os bifes e grelhe por 3 minutos de cada lado.","Monte a salada e sirva tudo junto."]}','4'),
('demo-bolo-de-caneca','receitas','Bolo de caneca de chocolate','Receita demonstrativa','Uma sobremesa rápida no micro-ondas, apresentada como exemplo de receita prática.','Receita demonstrativa.',null,null,'{sobremesa,rápida}',false,false,null,null,'{"rendimento":"1 porção","tempo":"5 minutos","ingredientes":["1 ovo","4 colheres de leite","3 colheres de açúcar","2 colheres de chocolate em pó","4 colheres de farinha","1 colher de café de fermento"],"preparo":["Misture tudo na caneca.","Leve ao micro-ondas por 2 minutos.","Deixe descansar 1 minuto antes de comer."]}','26'),
('demo-feriado-prolongado','brasil','Exemplo: planejamento para feriados prolongados','Conteúdo demonstrativo','Publicação de exemplo sobre organização de viagens e deslocamentos em feriados nacionais.','Texto demonstrativo para apresentar o G+ Brasil.',null,null,'{viagem,feriado}',false,false,null,null,null,'6'),
('demo-censo-explicador','brasil','Exemplo: para que servem as pesquisas populacionais','Explicador demonstrativo','Conteúdo demonstrativo que explica a importância de levantamentos populacionais para políticas públicas.','Texto demonstrativo.',null,null,'{dados,população}',false,false,null,null,null,'40'),
('demo-cupula-clima','mundo','Exemplo: o que acontece em uma cúpula internacional','Explicador demonstrativo','Conteúdo demonstrativo sobre o funcionamento de encontros entre países.','Texto demonstrativo para o G+ Mundo.',null,null,'{diplomacia}',false,false,null,null,null,'7'),
('demo-fuso-horario','mundo','Exemplo: como os fusos horários afetam viagens','Conteúdo demonstrativo','Publicação de exemplo sobre adaptação ao jet lag em viagens internacionais.','Texto demonstrativo.',null,null,'{viagem,curiosidades}',false,false,null,null,null,'50'),
('demo-reserva-emergencia','economia','Reserva de emergência: por onde começar','Educação financeira — exemplo','Conteúdo demonstrativo com conceitos básicos sobre reserva financeira para imprevistos.','Texto demonstrativo. Não é recomendação de investimento.','economia','Notebook com gráficos financeiros, café e caderno','{finanças pessoais}',false,true,null,null,null,'8'),
('demo-pequenos-negocios','economia','Exemplo: ferramentas digitais para pequenos negócios','Conteúdo demonstrativo','Publicação de exemplo sobre organização de vendas e estoque em pequenos negócios.','Texto demonstrativo.',null,null,'{empreendedorismo}',false,false,null,null,null,'28'),
('demo-ia-no-dia-a-dia','tecnologia','IA no dia a dia: usos práticos e cuidados','Explicador demonstrativo','Conteúdo demonstrativo sobre como assistentes de inteligência artificial podem ajudar em tarefas comuns.',E'Texto demonstrativo.\n\nAssistentes de IA podem ajudar a resumir textos e organizar ideias. Sempre verifique informações importantes.','tecnologia','Placa de circuito com luzes laranja','{inteligência artificial}',false,true,null,null,null,'0.5'),
('demo-senhas-seguras','tecnologia','Senhas seguras em 3 passos','Guia demonstrativo','Conteúdo demonstrativo sobre gerenciadores de senha e autenticação em dois fatores.','Texto demonstrativo.',null,null,'{segurança,privacidade}',true,false,null,null,null,'9'),
('demo-corrida-de-rua','esportes','Exemplo: como se preparar para a primeira corrida de rua','Conteúdo demonstrativo','Publicação de exemplo com orientações gerais para iniciantes.','Texto demonstrativo.','esportes','Corredores em pista ao amanhecer','{corrida,iniciantes}',false,false,null,null,null,'10'),
('demo-futebol-base','esportes','Exemplo: a importância das categorias de base','Conteúdo demonstrativo','Publicação de exemplo sobre formação de atletas jovens.','Texto demonstrativo.',null,null,'{futebol}',false,false,null,null,null,'33'),
('demo-cinema-nacional','cultura','Exemplo: um roteiro pelo cinema nacional','Conteúdo demonstrativo','Publicação de exemplo com sugestões gerais para conhecer a produção audiovisual brasileira.','Texto demonstrativo.',null,null,'{cinema}',false,false,null,null,null,'11'),
('demo-feiras-livro','cultura','Exemplo: por que visitar feiras de livros','Conteúdo demonstrativo','Publicação de exemplo sobre leitura e eventos culturais.','Texto demonstrativo.',null,null,'{literatura}',false,false,null,null,null,'45'),
('demo-estudo-ativo','educacao','Técnicas de estudo ativo','Guia demonstrativo','Conteúdo demonstrativo sobre revisão espaçada e autoexplicação.','Texto demonstrativo.',null,null,'{estudos}',false,false,null,null,null,'12'),
('demo-bolsas-estudo','educacao','Exemplo: como pesquisar bolsas de estudo','Conteúdo demonstrativo','Publicação de exemplo sobre organização de candidaturas.','Texto demonstrativo.',null,null,'{oportunidades}',false,false,null,null,null,'36'),
('demo-compostagem','meio-ambiente','Compostagem doméstica para iniciantes','Guia demonstrativo','Conteúdo demonstrativo sobre como reaproveitar resíduos orgânicos em casa.','Texto demonstrativo.',null,null,'{sustentabilidade}',false,false,null,null,null,'13'),
('demo-arvores-urbanas','meio-ambiente','Exemplo: o papel das árvores nas cidades','Conteúdo demonstrativo','Publicação de exemplo sobre sombra, temperatura e biodiversidade urbana.','Texto demonstrativo.',null,null,'{clima,natureza}',false,false,'Curitiba','PR',null,'22')
) as v(slug,channel,title,subtitle,summary,body,image_key,image_alt,tags,urgent,featured,city,state,recipe,hrs)
join public.channels c on c.slug = v.channel;