import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, loading: false },
  guest: vi.fn(),
  posts: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth, rememberIntent: vi.fn() }));
vi.mock("@/lib/api", () => ({
  GUEST_POST_LIMIT: 5,
  fetchGuestPosts: state.guest,
  fetchPosts: state.posts,
}));
vi.mock("@/components/giro/PostItem", () => ({
  PostItem: ({ post }: { post: { title: string } }) => <article>{post.title}</article>,
  PostSkeleton: () => <span>Carregando</span>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
import { Feed } from "@/components/giro/Feed";

function posts(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `post-${index}`,
    title: `Notícia ${index}`,
    published_at: new Date(Date.UTC(2026, 10, 6, 12, index)).toISOString(),
  }));
}
function setup() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={cache}>
      <Feed queryKey={["ultimas"]} showFollow />
    </QueryClientProvider>
  );
  const view = render(tree());
  return { rerender: () => view.rerender(tree()) };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.auth.user = null;
  state.auth.loading = false;
  state.guest.mockResolvedValue(posts(8));
  state.posts.mockResolvedValue(posts(8));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Prévia de notícias para visitantes", () => {
  it("exibe no máximo cinco cards e convida para entrar sem paginação", async () => {
    setup();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(5));
    expect(screen.getByRole("link", { name: "Entrar com Google" })).toHaveAttribute(
      "href",
      "/entrar",
    );
    expect(state.posts).not.toHaveBeenCalled();
    expect(state.guest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Você chegou ao fim.")).not.toBeInTheDocument();
    expect(screen.queryByText("Notícia 5")).not.toBeInTheDocument();
  });
  it("espera a sessão antes de consultar o feed", () => {
    state.auth.loading = true;
    setup();
    expect(state.guest).not.toHaveBeenCalled();
    expect(state.posts).not.toHaveBeenCalled();
  });
  it("separa caches entre visitante e leitor e volta ao limite após sair", async () => {
    const view = setup();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(5));
    state.auth.user = { id: "reader" };
    view.rerender();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(8));
    expect(state.posts).toHaveBeenCalled();
    state.auth.user = null;
    view.rerender();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(5));
  });
});
