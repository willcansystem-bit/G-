# Giro+ — implementação pelo Codex

As mudanças são mantidas neste repositório e não dependem do editor Lovable.
Não houve publicação nem alteração do banco remoto durante a implementação local.

## Desenvolvimento e validação

Requer Node.js 22 e Bun para reproduzir as dependências do `bun.lock`.

```sh
bun install --frozen-lockfile
bun run dev
bun run test
bun run test:database
bunx tsc --noEmit
bun run build
```

Em unidade de rede, instale e execute as verificações numa cópia local temporária.
Os testes de banco usam PostgreSQL descartável via PGlite. Eles criam somente
substitutos locais de `auth.users`, `auth.uid()` e do catálogo de Storage para
executar a migração original e a nova migração, inclusive RLS com papéis distintos.
Não validam o serviço real de autenticação, entrega de e-mail ou upload HTTP.

## Ativar no banco existente

A base esperada é a migração existente `drizzle/migrations/0000_migration.sql`.
As migrações `202611060001_giro_community.sql` e
`202611060002_guest_news_limit.sql` são incrementais e não recriam usuários,
canais ou notícias. O comando de migração aplica as duas na ordem e ignora as já registradas.
As alterações em `drizzle/schema.ts` e clientes gerados foram evitadas.

Disponibilize `DATABASE_URL` no ambiente do processo com uma conexão administrativa
ao PostgreSQL correto. Não coloque a conexão no código nem envie senhas no chat.
Depois execute:

```sh
bun run db:migrate
```

O comando usa TLS por padrão, trava a execução concorrente e registra a migração
em `public.giro_schema_migrations`. Migração e registro são uma transação.
`DB_SSL=disable` destina-se somente a PostgreSQL local sem TLS.

O banco precisa conter o Auth e o Storage do Supabase. A migração cria o bucket
`avatars`, suas políticas, funções de atendimento e métricas. O bucket, inclusive
quando já existir, recebe os limites de formato e tamanho definidos pela migração.
Novas fotos são públicas; dados privados do perfil
não são publicados junto com a imagem.

Contas administrativas precisam de papel `admin` em `public.user_roles`, atribuído
por um operador já autorizado. `editor` permite atendimento e moderação, mas não
métricas nem consulta administrativa dos dados pessoais. Leitores não atribuem
papéis nem criam canais ou notícias. Não existe conta administrativa de teste ou
senha padrão no aplicativo.

## Comportamento

- Início: `Últimas` é a entrada pública; `Para você` usa exclusivamente os canais
  seguidos, em ordem cronológica. A aba fica na URL e a restauração de rolagem usa
  o histórico do roteador. Novas notícias aguardam ação do leitor.
- Canais: busca por nome/descrição, filtros Todos/Meus canais e seguir/deixar de
  seguir com estado otimista compartilhado, reversão de erro e bloqueio de duplicidade.
- Login: somente Google, com criação automática da conta no primeiro acesso. A intenção
  de seguir e a rota de retorno ficam na sessão do navegador até o login concluir.
- Perfil: recorte com zoom e deslocamento, otimização WebP 512 × 512, validação de
  JPEG/PNG/WebP até 5 MB, substituição/remoção persistida e avatar padrão.
- Perfis públicos retornam só nome, usuário, foto, bio e localização consentida.
  E-mail e interesses permanecem privados; a localização é privada por padrão.
- Comentários: leitura após login, respostas identificadas, paginação de 30, edição e
  exclusão pelo autor, denúncia e moderação pela equipe. Remover por moderação também
  oculta publicamente as respostas descendentes. Consultas são atualizadas a cada 15 s.
- Fale com o Giro+: uma conversa por leitor, assunto selecionável e histórico
  paginado. A equipe responde na Administração. Mensagens são atualizadas a cada 10 s.
  Não há mensagens entre leitores. “Enviada” indica persistência; “Lida” só aparece
  após consulta da página que contém a mensagem pelo destinatário autorizado.
- Métricas: autorização no banco, usuários paginados com filtros, relações únicas
  de seguidores, variação diária e rankings separados de interações reais.

## Limites dos dados e homologação

Atividade é a abertura do app autenticado em um dia UTC, sem inferir interesses.
O histórico de seguidores começa na ativação; o primeiro ponto inclui a base
existente. Não se reconstrói crescimento anterior. Interações contam relações
ainda existentes criadas no período; exclusões não são tratadas como eventos
históricos de engajamento. Distribuição e seguidores são o estado atual. Cadastros
são globais; o filtro de canal aplica-se onde indicado. A soma de seguidores de
canais diferentes pode contar a mesma pessoa mais de uma vez.

Não há coleta de visualizações ou de envio efetivo de compartilhamentos.
Os botões de compartilhamento existentes continuam disponíveis.

Depois de aplicar a migração, homologar no ambiente conectado: entrada e retorno
do Google, seguir após login, upload/recorte/remoção com recarga, leitura de comentários
em dois usuários e visitante, atendimento entre leitor e equipe, negação de acesso
a outra conversa e métricas, além da rolagem e do layout em desktop e celular.
Compilação e testes locais não substituem essa homologação.

Validação local realizada: compilação, TypeScript, 16 testes de interface/rotas,
12 cenários de migração/RLS em PostgreSQL e smoke no Chrome em desktop/mobile.
O smoke usa leitura pública do backend já configurado; as novas funções ainda
dependem da aplicação da migração no ambiente conectado.

## Entrada pelo Google

A interface usa exclusivamente `supabase.auth.signInWithOAuth` com `provider: google`.
O retorno é para `/entrar` na mesma origem, onde a sessão é confirmada antes de
retomar a ação pendente. O cliente Supabase existente processa o retorno OAuth.
Não há formulário de senha, cadastro por e-mail nem envio de link mágico.

O endereço local e o domínio publicado, incluindo `/entrar`, precisam estar na
lista de redirecionamentos permitidos do Auth. Referência:
[redirecionamentos OAuth](https://supabase.com/docs/guides/auth/redirect-urls).

Na verificação de 06/11/2026, a configuração pública do backend retornou Google
habilitado e e-mail habilitado. Porém, a tentativa real de iniciar o OAuth direto
retornou HTTP 400: `Unsupported provider: missing OAuth secret`. É necessário
configurar as credenciais OAuth do Google no provedor do backend para concluir
esse fluxo. Não basta o indicador público de Google habilitado. A interface já
removeu a entrada por e-mail, mas
a exclusividade no serviço Auth exige desligar os demais provedores no servidor,
sem desabilitar globalmente a criação de usuários OAuth. Essa configuração requer
credencial administrativa de Auth; a chave pública do app não tem essa permissão.
Não houve mudança remota de provedores nesta implementação.
Referência: [configuração administrativa do Auth](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

## Regra de visitante: cinco prévias

Sem sessão autenticada, a página inicial apresenta somente as cinco notícias mais
recentes de todos os canais ativos, ordenadas por publicação e, em caso de empate,
pelo ID decrescente. Não existe paginação anônima. A prévia contém título, resumo,
imagem e identificação editorial; não consulta o corpo completo da notícia.
O conjunto é atualizado periodicamente sem acumular notícias antigas.

Abrir notícia completa, consultar canais, comentários ou perfis, compartilhar,
copiar links, curtir, salvar, seguir, acessar configurações ou contatar a equipe
exige login. Rotas protegidas encaminham ao Google sem montar o conteúdo nem
executar loaders públicos, preservando a rota pretendida. Os caches do feed são
separados entre visitante e usuário para não reaproveitar o feed completo após sair.

Essa regra substitui a permissão anterior de leitura de comentários por visitantes.
A migração `202611060002_guest_news_limit.sql` limita o papel `anon` às cinco
notícias globais e às colunas da prévia; bloqueia também comentários e a função de
perfil para visitantes. Filtros por canal, offset e acesso por ID não liberam um
novo conjunto de cinco. Usuários autenticados continuam com o feed completo.

A proteção do banco remoto só entra em vigor após `bun run db:migrate` com
`DATABASE_URL` disponível no ambiente. A limitação de interface já funciona na
prévia local; ela não substitui a aplicação das políticas no ambiente conectado.
Os testes de banco executam a migração inicial, verificam seu comportamento e
depois aplicam a regra de visitante para comprovar as restrições finais.
