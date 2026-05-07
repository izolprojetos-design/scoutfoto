import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

/**
 * E2E (componente): garante que, ao tentar responder novamente um agendamento
 * que já saiu de "pendente", o destinatário vê o banner destacado de conflito
 * e a lista é recarregada (refresh do status pelo servidor) — bloqueando ações.
 */

const ME = { id: "user-me", email: "destinatario@example.com" };

const initialRow = {
  id: "agd-1",
  user_id: "user-other",
  nome_associado: "REMETENTE",
  secao: "Tropa",
  dirigente: "Chefe",
  cargo_1: "", cargo_2: "",
  email_de: "remetente@example.com",
  email_para: ME.email,
  destinatario_nome: "DEST",
  destinatario_secao: "Tropa",
  destinatario_cargo_1: "", destinatario_cargo_2: "",
  data_secao: "2099-01-01",
  horario: "10:00:00",
  local: "Sede",
  ramo_escoteiro: "br1",
  tipo_atividade: "reuniao",
  observacoes: "Assunto",
  status: "agendado",
  created_at: new Date().toISOString(),
  recipient_response: "pendente" as const,
  recipient_response_reason: null,
  recipient_response_at: null,
  recipient_response_by: null,
};

// O servidor já confirmou (estado real) — quando o cliente recarregar via
// maybeSingle(), receberá esse estado e deverá disparar o conflict banner.
let serverRow: any = { ...initialRow, recipient_response: "confirmado", recipient_response_at: new Date().toISOString() };

const channelMock = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "agendamentos") {
        return {
          select: () => ({
            // listagem inicial: cliente acredita estar pendente
            order: () => Promise.resolve({ data: [initialRow], error: null }),
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: serverRow, error: null }) }),
          }),
        };
      }
      if (table === "branches") {
        return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
      }
      if (table === "agendamento_archives") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
      return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
    },
    channel: () => channelMock,
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: { code: "22023", message: "Este agendamento já foi confirmado" },
    }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: ME, roles: [] }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/scoutUtils", () => ({ parseLocalDate: (s: string) => new Date(`${s}T00:00:00`) }));

import AgendamentosManager from "../AgendamentosManager";

describe("AgendamentosManager — re-resposta exibe banner e recarrega status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ao tentar Confirmar com estado obsoleto: mostra banner destacado e refresca o status", async () => {
    render(<AgendamentosManager />);
    await waitFor(() => expect(screen.queryByText(/Carregando agendamentos/i)).toBeNull());

    const header = await screen.findByRole("option");
    fireEvent.click(header);

    const confirm = await screen.findByTestId("confirm-btn-agd-1");
    fireEvent.click(confirm);

    // Banner destacado de conflito aparece
    const banner = await screen.findByTestId("conflict-banner-agd-1");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/Não é possível responder novamente/i);

    // Após o refresh, o item passa a mostrar o estado consolidado vindo do servidor
    expect(await screen.findByText(/Destinatário confirmou/i)).toBeInTheDocument();

    // E os botões de Confirmar/Recusar somem (estado final)
    expect(screen.queryByTestId("confirm-btn-agd-1")).toBeNull();
    expect(screen.queryByTestId("reject-btn-agd-1")).toBeNull();
  });
});
