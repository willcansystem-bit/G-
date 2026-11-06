import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  me: { data: { follows: new Set<string>() }, isPending: false, isError: false, refetch: vi.fn() },
  tab: "ultimas" as "ultimas" | "para-voce",
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state, useMyState: () => state.me }));
vi.mock("@/components/giro/AppShell", () => ({
  PageHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
}));
vi.mock("@/components/giro/Feed", () => ({
  Feed: ({ channelIds, showFollow }: { channelIds?: string[]; showFollow?: boolean }) => (
    <div data-testid="feed" data-follow={String(!!showFollow)}>
      {channelIds?.join(",") ?? "todos"}
    </div>
  ),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...original,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});
import { Route } from "@/routes/index";
const Home = Route.options.component as ComponentType;

beforeEach(() => {
  state.user = null;
  state.loading = false;
  state.me.data.follows = new Set();
  state.me.isPending = false;
  state.me.isError = false;
  state.tab = "ultimas";
  vi.spyOn(Route, "useSearch").mockImplementation(() => ({ tab: state.tab }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Feed editorial", () => {
  it("permite últimas para visitantes com ação de seguir", () => {
    render(<Home />);
    expect(screen.getByTestId("feed")).toHaveTextContent("todos");
    expect(screen.getByTestId("feed")).toHaveAttribute("data-follow", "true");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Para você",
      "Últimas",
    ]);
  });
  it("orienta visitantes para autenticação no Para você", () => {
    state.tab = "para-voce";
    render(<Home />);
    expect(screen.getByRole("link", { name: "Entrar com Google" })).toHaveAttribute(
      "href",
      "/entrar",
    );
    expect(screen.queryByTestId("feed")).not.toBeInTheDocument();
  });
  it("oferece apenas escolher canais quando o leitor não segue nenhum", () => {
    state.user = { id: "leitor" };
    state.tab = "para-voce";
    render(<Home />);
    expect(
      screen.getByText(
        "Seu giro começa aqui. Siga os canais que você gosta para acompanhar as notícias.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Escolher canais" })).toHaveAttribute(
      "href",
      "/canais",
    );
    expect(screen.queryByTestId("feed")).not.toBeInTheDocument();
  });
  it("filtra estritamente por canais seguidos e atualiza ao seguir e deixar de seguir", () => {
    state.user = { id: "leitor" };
    state.tab = "para-voce";
    state.me.data.follows = new Set(["saude"]);
    const view = render(<Home />);
    expect(screen.getByTestId("feed")).toHaveTextContent(/^saude$/);
    state.me.data.follows = new Set(["saude", "politica"]);
    view.rerender(<Home />);
    expect(screen.getByTestId("feed")).toHaveTextContent(/^politica,saude$/);
    state.me.data.follows = new Set(["politica"]);
    view.rerender(<Home />);
    expect(screen.getByTestId("feed")).toHaveTextContent(/^politica$/);
  });
  it("não apresenta vazio falso enquanto os canais carregam", () => {
    state.user = { id: "leitor" };
    state.tab = "para-voce";
    state.me.isPending = true;
    render(<Home />);
    expect(screen.getByText("Carregando seu giro…")).toBeInTheDocument();
    expect(screen.queryByText("Escolher canais")).not.toBeInTheDocument();
  });
  it("oferece nova tentativa quando a consulta privada falha", () => {
    state.user = { id: "leitor" };
    state.tab = "para-voce";
    state.me.isError = true;
    render(<Home />);
    expect(screen.getByRole("button", { name: /Tentar novamente/ })).toBeInTheDocument();
    expect(screen.queryByTestId("feed")).not.toBeInTheDocument();
  });
});
