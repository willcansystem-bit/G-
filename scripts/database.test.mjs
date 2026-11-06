import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Giro+ — migração e isolamento no PostgreSQL", async (context) => {
  const database = new PGlite();
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const admin = "33333333-3333-4333-8333-333333333333";
  const editor = "44444444-4444-4444-8444-444444444444";
  async function identity(id, role = "authenticated") {
    await database.exec("reset role");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
    await database.exec(`set role ${role}`);
  }
  const scalar = async (query, params = []) => (await database.query(query, params)).rows[0].value;
  try {
    await database.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now(), banned_until timestamptz, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth,storage,public to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      create table storage.buckets (id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert,delete on storage.objects to authenticated;
      grant select on storage.objects to anon;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    `);
    await database.exec(
      await readFile(new URL("../drizzle/migrations/0000_migration.sql", import.meta.url), "utf8"),
    );
    await database.exec(
      await readFile(
        new URL("../supabase/migrations/202611060001_giro_community.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const id of [first, second, admin, editor])
      await database.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
        [id, `${id.slice(0, 2)}@example.test`],
      );
    await database.query(
      "insert into public.user_roles(user_id,role) values($1,'admin'),($2,'editor')",
      [admin, editor],
    );
    const health = await scalar("select id as value from public.channels where slug='saude'");
    const politics = await scalar("select id as value from public.channels where slug='politica'");
    const post = await scalar("select id as value from public.posts where channel_id=$1 limit 1", [
      health,
    ]);
    let root;
    let reply;
    let conversation;
    await context.test(
      "seguir e deixar de seguir mantém relações únicas e contagens reais",
      async () => {
        await identity(first);
        await database.query(
          "insert into public.channel_follows(user_id,channel_id) values($1,$2),($1,$3)",
          [first, health, politics],
        );
        assert.equal(await scalar("select count(*)::int as value from public.channel_follows"), 2);
        await assert.rejects(
          database.query("insert into public.channel_follows(user_id,channel_id) values($1,$2)", [
            first,
            health,
          ]),
        );
        await database.query("delete from public.channel_follows where channel_id=$1", [politics]);
        assert.equal(
          await scalar("select followers_count as value from public.channels where id=$1", [
            health,
          ]),
          1,
        );
        assert.equal(
          await scalar("select followers_count as value from public.channels where id=$1", [
            politics,
          ]),
          0,
        );
        await identity(second);
        assert.equal(await scalar("select count(*)::int as value from public.channel_follows"), 0);
        await assert.rejects(
          database.query("insert into public.channel_follows(user_id,channel_id) values($1,$2)", [
            first,
            politics,
          ]),
        );
      },
    );
    await context.test("leitores não criam canais nem publicações", async () => {
      await identity(first);
      await assert.rejects(
        database.exec(
          "insert into public.channels(slug,name,description) values('fake','Fake','Fake')",
        ),
      );
      await assert.rejects(
        database.query(
          "insert into public.posts(slug,title,summary,channel_id) values('fake','Fake','Fake',$1)",
          [health],
        ),
      );
    });
    await context.test(
      "comentários e respostas são compartilhados com leitores e visitantes",
      async () => {
        await identity(first);
        root = await scalar(
          "insert into public.comments(post_id,user_id,body) values($1,$2,'Primeiro comentário') returning id as value",
          [post, first],
        );
        reply = await scalar(
          "insert into public.comments(post_id,user_id,body,parent_id) values($1,$2,'Resposta pública',$3) returning id as value",
          [post, first, root],
        );
        await identity(second);
        const comments = await scalar("select public.giro_comments($1) as value", [post]);
        assert.equal(comments.length, 2);
        assert.equal(comments[1].parent_id, root);
        await identity(null, "anon");
        assert.equal((await scalar("select public.giro_comments($1) as value", [post])).length, 2);
        await assert.rejects(
          database.query(
            "insert into public.comments(post_id,user_id,body) values($1,$2,'Anônimo')",
            [post, first],
          ),
        );
      },
    );
    await context.test(
      "dados de cadastro permanecem privados e avatar exige propriedade",
      async () => {
        await identity(null, "anon");
        await assert.rejects(database.exec("select interests,city from public.profiles"));
        await identity(first);
        assert.equal(await scalar("select count(*)::int as value from public.profiles"), 1);
        await database.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [
          `${first}/photo.webp`,
        ]);
        await database.query("select public.giro_avatar($1)", [`${first}/photo.webp`]);
        const own = await scalar("select public.giro_profile() as value");
        assert.equal(own.avatar_url, `${first}/photo.webp`);
        assert.equal(own.show_location, false);
        await database.query("select public.giro_save_profile($1)", [
          {
            display_name: "Leitor Um",
            username: "leitor_um",
            city: "Recife",
            state: "PE",
            interests: ["Saúde"],
            show_location: false,
          },
        ]);
        await identity(second);
        await assert.rejects(
          database.query("select public.giro_avatar($1)", [`${first}/photo.webp`]),
        );
        await identity(null, "anon");
        const publicProfile = await scalar(
          "select public.giro_public_profile('leitor_um') as value",
        );
        assert.equal(publicProfile.city, null);
        assert.equal("interests" in publicProfile, false);
        assert.equal("email" in publicProfile, false);
        const comments = await scalar("select public.giro_comments($1) as value", [post]);
        assert.equal(comments[0].avatar_url, `${first}/photo.webp`);
        assert.equal("interests" in comments[0], false);
        await identity(first);
        await database.query("select public.giro_save_profile($1)", [
          {
            display_name: "Leitor Um",
            username: "leitor_um",
            city: "Recife",
            state: "PE",
            interests: ["Saúde"],
            show_location: true,
          },
        ]);
        assert.equal(
          (await scalar("select public.giro_public_profile('leitor_um') as value")).city,
          "Recife",
        );
        await database.exec("select public.giro_avatar(null)");
        assert.equal((await scalar("select public.giro_profile() as value")).avatar_url, null);
      },
    );
    await context.test("somente autor edita e exclui seus comentários", async () => {
      await identity(second);
      assert.equal(
        (
          await database.query(
            "update public.comments set body='Invadido' where id=$1 returning id",
            [root],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (await database.query("delete from public.comments where id=$1 returning id", [root])).rows
          .length,
        0,
      );
      await identity(first);
      await database.query("update public.comments set body='Editado pelo autor' where id=$1", [
        root,
      ]);
      assert.equal(
        await scalar("select is_edited as value from public.comments where id=$1", [root]),
        true,
      );
      await database.query("delete from public.comments where id=$1", [reply]);
    });
    await context.test(
      "conversas privadas não admitem outro leitor e leitura corresponde ao evento",
      async () => {
        await identity(first);
        conversation = await scalar("select public.giro_send('Olá, equipe','Suporte') as value");
        assert.equal(
          (await scalar("select public.giro_thread($1) as value", [conversation]))[0].read_at,
          null,
        );
        await identity(second);
        assert.equal(await scalar("select count(*)::int as value from public.team_messages"), 0);
        await assert.rejects(database.query("select public.giro_thread($1)", [conversation]));
        await assert.rejects(
          database.query("select public.giro_send('Invadido','Outro',$1)", [conversation]),
        );
        await identity(editor);
        assert.equal(await scalar("select public.giro_unread()::int as value"), 1);
        assert.ok(
          (await scalar("select public.giro_thread($1) as value", [conversation]))[0].read_at,
        );
        await database.query("select public.giro_send('Resposta da equipe','Suporte',$1)", [
          conversation,
        ]);
        await identity(first);
        assert.equal(await scalar("select public.giro_unread()::int as value"), 1);
        const thread = await scalar("select public.giro_thread($1) as value", [conversation]);
        assert.equal(thread.length, 2);
        assert.ok(thread[0].read_at);
        assert.equal(await scalar("select public.giro_unread()::int as value"), 0);
      },
    );
    await context.test(
      "métricas e lista de dados pessoais exigem administrador no backend",
      async () => {
        for (const id of [first, second, editor]) {
          await identity(id);
          await assert.rejects(
            database.exec("select public.giro_metrics(current_date-30,current_date)"),
          );
          await assert.rejects(database.exec("select public.giro_users()"));
        }
        await identity(admin);
        const metrics = await scalar(
          "select public.giro_metrics(current_date-30,current_date) as value",
        );
        assert.equal(metrics.total, 4);
        assert.equal(metrics.followers.find((channel) => channel.id === health).followers, 1);
        assert.equal(metrics.followers.find((channel) => channel.id === politics).growth, 0);
        assert.equal((await scalar("select public.giro_users() as value")).length, 4);
      },
    );
    await context.test("moderação retira comentário e respostas do acesso público", async () => {
      await identity(first);
      await database.query(
        "insert into public.comments(post_id,user_id,body,parent_id) values($1,$2,'Resposta a remover junto',$3)",
        [post, first, root],
      );
      await identity(second);
      await database.query("select public.giro_report($1,'Revisar comentário')", [root]);
      await assert.rejects(database.exec("select public.giro_reports()"));
      await identity(editor);
      const reports = await scalar("select public.giro_reports() as value");
      await database.query("select public.giro_moderate($1,true)", [reports[0].id]);
      await identity(null, "anon");
      assert.equal((await scalar("select public.giro_comments($1) as value", [post])).length, 0);
      assert.equal(
        await scalar("select count(*)::int as value from public.comments where id=$1", [root]),
        0,
      );
    });
    await context.test("paginação permite consultar além de 30 comentários", async () => {
      await identity(first);
      await database.query(
        "insert into public.comments(post_id,user_id,body) select $1,$2,'Comentário '||number from generate_series(1,35) number",
        [post, first],
      );
      await identity(null, "anon");
      const page = await scalar("select public.giro_comments($1,0) as value", [post]);
      const next = await scalar("select public.giro_comments($1,30) as value", [post]);
      assert.equal(page.length, 30);
      assert.equal(next.length, 5);
      assert.equal(new Set([...page, ...next].map((comment) => comment.id)).size, 35);
    });
    await context.test(
      "regra de visitante limita globalmente às cinco notícias mais recentes",
      async () => {
        await identity(null, "service_role");
        const expected = (
          await database.query(
            "select post.id from public.posts post join public.channels channel on channel.id=post.channel_id where post.status='published' and channel.status='active' order by post.published_at desc,post.id desc limit 5",
          )
        ).rows.map((row) => row.id);
        const older = (
          await database.query(
            "select post.id from public.posts post join public.channels channel on channel.id=post.channel_id where post.status='published' and channel.status='active' order by post.published_at desc,post.id desc offset 5 limit 1",
          )
        ).rows[0].id;
        await database.exec("reset role");
        await database.exec(
          await readFile(
            new URL("../supabase/migrations/202611060002_guest_news_limit.sql", import.meta.url),
            "utf8",
          ),
        );
        await identity(null, "anon");
        const visible = (
          await database.query(
            "select id from public.posts order by published_at desc,id desc limit 500",
          )
        ).rows.map((row) => row.id);
        assert.deepEqual(visible, expected);
        await assert.rejects(database.exec("select body,recipe,sources from public.posts"));
        assert.equal(
          await scalar("select count(*)::int as value from public.posts where id=$1", [older]),
          0,
        );
        assert.equal(
          (
            await database.query(
              "select id from public.posts order by published_at desc,id desc offset 5",
            )
          ).rows.length,
          0,
        );
        const channelVisible = (
          await database.query("select id from public.posts where channel_id=$1", [health])
        ).rows.map((row) => row.id);
        assert.ok(channelVisible.every((id) => expected.includes(id)));
      },
    );
    await context.test(
      "visitantes não consultam comentários ou perfis; leitores mantêm acesso completo",
      async () => {
        await identity(null, "anon");
        await assert.rejects(database.query("select public.giro_comments($1)", [post]));
        await assert.rejects(database.exec("select public.giro_public_profile('leitor_um')"));
        assert.equal(await scalar("select count(*)::int as value from public.comments"), 0);
        await assert.rejects(database.exec("select public.giro_inbox()"));
        await identity(first);
        assert.ok((await scalar("select count(*)::int as value from public.posts")) > 5);
        assert.equal((await scalar("select public.giro_comments($1) as value", [post])).length, 30);
        assert.equal(
          (await scalar("select public.giro_comments($1,30) as value", [post])).length,
          5,
        );
      },
    );
    await context.test(
      "novas publicações atualizam o conjunto público com desempate estável",
      async () => {
        await database.exec("reset role");
        await database.query(
          "insert into public.posts(id,slug,channel_id,title,summary,published_at) select ('50000000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,'tie-'||number,$1,'Empate '||number,'Prévia',date_trunc('second',now()) from generate_series(1,6) number",
          [health],
        );
        await database.query(
          "insert into public.posts(slug,channel_id,title,summary,status,published_at) values('draft-guest',$1,'Rascunho','Privado','draft',now()+interval '1 day')",
          [health],
        );
        await identity(null, "anon");
        const rows = (
          await database.query("select slug from public.posts order by published_at desc,id desc")
        ).rows;
        assert.deepEqual(
          rows.map((row) => row.slug),
          ["tie-6", "tie-5", "tie-4", "tie-3", "tie-2"],
        );
        assert.equal(
          (await database.query("select id from public.posts where slug='tie-1'")).rows.length,
          0,
        );
        await database.exec("reset role");
        await database.query("update public.channels set status='hidden' where id=$1", [health]);
        await identity(null, "anon");
        assert.equal(
          await scalar("select count(*)::int as value from public.posts where channel_id=$1", [
            health,
          ]),
          0,
        );
        assert.equal(await scalar("select count(*)::int as value from public.posts"), 5);
      },
    );
  } finally {
    await database.close();
  }
});
