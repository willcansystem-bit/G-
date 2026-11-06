import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const state = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, loading: false },
  navigate: vi.fn(),
  oauth: vi.fn(),
  getUser: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signInWithOAuth: state.oauth, getUser: state.getUser },
    from: () => ({ upsert: state.upsert }),
  },
}));
vi.mock("@/hooks/useAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useAuth")>()),
  useAuth: () => state.auth,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => state.navigate,
}));
vi.mock("@/components/giro/AppShell", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { Route } from "@/routes/entrar";
const Login = Route.options.component as ComponentType;
function renderLogin() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Login />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.auth.user = null;
  state.auth.loading = false;
  state.oauth.mockResolvedValue({ data: { url: "https://accounts.google.com/" }, error: null });
  state.getUser.mockResolvedValue({ data: { user: { id: "reader" } }, error: null });
  state.upsert.mockResolvedValue({ error: null });
  state.navigate.mockResolvedValue(undefined);
  sessionStorage.clear();
  window.history.replaceState(null, "", "/entrar");
});
afterEach(cleanup);

describe("Entrada somente com Google", () => {
  it("mostra somente Google e não renderiza campos ou cadastro por senha", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /Criar conta/ })).not.toBeInTheDocument();
  });
  it("inicia somente OAuth Google com retorno à tela de entrada", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));
    await waitFor(() =>
      expect(state.oauth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/entrar`,
          queryParams: { prompt: "select_account" },
        },
      }),
    );
    expect(screen.getByRole("button", { name: "Aguarde…" })).toBeDisabled();
  });
  it("permite tentar novamente quando o OAuth não pode ser iniciado", async () => {
    state.oauth.mockResolvedValue({ data: { url: null }, error: new Error("Unavailable") });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível iniciar a entrada com Google.",
    );
    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeEnabled();
  });
  it("trata cancelamento e remove os detalhes do erro da URL", async () => {
    window.history.replaceState(null, "", "/entrar#error=access_denied&error_description=Denied");
    renderLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("cancelada");
    expect(window.location.hash).toBe("");
    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeEnabled();
  });
  it("conclui o seguir pendente e retorna à rota após autenticação", async () => {
    state.auth.user = { id: "reader" };
    sessionStorage.setItem("giro:follow", "channel-health");
    sessionStorage.setItem("giro:next", "/?tab=para-voce");
    renderLogin();
    await waitFor(() =>
      expect(state.upsert).toHaveBeenCalledWith(
        { user_id: "reader", channel_id: "channel-health" },
        { onConflict: "user_id,channel_id", ignoreDuplicates: true },
      ),
    );
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/?tab=para-voce" }));
    expect(sessionStorage.getItem("giro:follow")).toBeNull();
  });
  it("preserva a intenção quando seguir falha e permite retomar", async () => {
    state.auth.user = { id: "reader" };
    state.upsert.mockResolvedValueOnce({ error: new Error("Offline") });
    sessionStorage.setItem("giro:follow", "channel-health");
    sessionStorage.setItem("giro:next", "/canais");
    renderLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("não foi possível seguir");
    expect(sessionStorage.getItem("giro:follow")).toBe("channel-health");
    expect(state.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/canais" }));
  });
});
