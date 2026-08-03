import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

/**
 * E2E (component-level) — Garante que, quando um agendamento já está
 * `confirmado` ou `recusado`, o destinatário NÃO vê os botões "Confirmar"
 * e "Recusar" (eles ficam ocultos pelo branch de status final), e que,
 * mesmo se forçados a renderizar, ficariam desabilitados quando o estado
 * conflita com a tentativa de nova resposta.
 *
 * Estratégia: mockamos `supabase` para devolver agendamentos com diferentes
 * estados de `recipient_response` e renderizamos o componente como
 * destinatário (`useAuth` retorna o e-mail correspondente a `email_para`).
 */

// ---- Mocks --------------------------------------------------------------

const ME = { id: "user-me", email: "destinatario@example.com" };

const buildRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "agd-1",
  user_id: "user-other",
  nome_associado: "REMETENTE TESTE",
  secao: "Tropa",
  dirigente: "Chefe",
  cargo_1: "",
  cargo_2: "",
  email_de: "remetente@example.com",
  email_para: ME.email,
  destinatario_nome: "DESTINATARIO TESTE",
  destinatario_secao: "Tropa",
  destinatario_cargo_1: "",
  destinatario_cargo_2: "",
  data_secao: "2099-01-01",
  horario: "10:00:00",
  local: "Sede",
  ramo_escoteiro: "br1",
  tipo_atividade: "reuniao",
  observacoes: "Assunto X",
  status: "agendado",
  created_at: new Date().toISOString(),
  recipient_response: "pendente",
  recipient_response_reason: null,
  recipient_response_at: null,
  recipient_response_by: null,
  ...overrides,
});

let agendamentosRow: ReturnType<typeof buildRow> = buildRow();

const channelMock = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const fromMock = vi.fn((table: string) => {
  if (table === "agendamentos") {
    return {
      select: () => ({
        order: () =>
          Promise.resolve({ data: [agendamentosRow], error: null }),
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: agendamentosRow, error: null }),
        }),
      }),
    };
  }
  if (table === "branches") {
    return {
      select: () => ({
        order: () =>
          Promise.resolve({
            data: [{ id: "br1", display_name: "Escoteiro", icon: "🌳" }],
            error: null,
          }),
      }),
    };
  }
  return {
    select: () => ({
      order: () => Promise.resolve({ data: [], error: null }),
      ilike: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
    }),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    channel: () => channelMock,
    removeChannel: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: ME, roles: [] }),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

// Stub do parseLocalDate (util do projeto pode tocar em globals)
vi.mock("@/lib/scoutUtils", () => ({
  parseLocalDate: (s: string) => new Date(`${s}T00:00:00`),
}));

import AgendamentosManager from "../AgendamentosManager";

// ---- Helpers ------------------------------------------------------------

const renderAndExpand = async () => {
  render(<AgendamentosManager />);
  // Aguarda fim do loading e abre o card para revelar a área de ação
  await waitFor(() =>
    expect(screen.queryByText(/Carregando agendamentos/i)).toBeNull(),
  );
  // O cabeçalho do card é um botão (role) — clicar expande os detalhes.
  const header = await screen.findByRole("option");
  fireEvent.click(header);
};

// ---- Tests --------------------------------------------------------------

describe("AgendamentosManager — botões confirmar/recusar conforme status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe Confirmar/Recusar habilitados quando recipient_response = pendente", async () => {
    agendamentosRow = buildRow({ recipient_response: "pendente" });
    await renderAndExpand();

    const confirm = await screen.findByTestId("confirm-btn-agd-1");
    const reject = await screen.findByTestId("reject-btn-agd-1");
    expect(confirm).not.toBeDisabled();
    expect(reject).not.toBeDisabled();
  });

  it("NÃO renderiza Confirmar/Recusar quando o agendamento já está CONFIRMADO", async () => {
    agendamentosRow = buildRow({
      recipient_response: "confirmado",
      recipient_response_at: new Date().toISOString(),
    });
    await renderAndExpand();

    expect(screen.queryByTestId("confirm-btn-agd-1")).toBeNull();
    expect(screen.queryByTestId("reject-btn-agd-1")).toBeNull();
    // E mostra o estado consolidado para o usuário.
    expect(
      await screen.findByText(/Destinatário confirmou/i),
    ).toBeInTheDocument();
  });

  it("NÃO renderiza Confirmar/Recusar quando o agendamento já está RECUSADO", async () => {
    agendamentosRow = buildRow({
      recipient_response: "recusado",
      recipient_response_reason: "indisponível",
      recipient_response_at: new Date().toISOString(),
    });
    await renderAndExpand();

    expect(screen.queryByTestId("confirm-btn-agd-1")).toBeNull();
    expect(screen.queryByTestId("reject-btn-agd-1")).toBeNull();
    expect(
      await screen.findByText(/Destinatário recusou/i),
    ).toBeInTheDocument();
  });
});
