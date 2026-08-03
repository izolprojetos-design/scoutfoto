import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

/**
 * E2E (componente) — Arquivar/Lixeira:
 *  1) Arquivar fica desabilitado enquanto pendente; reabilita após resposta (via realtime).
 *  2) Arquivar atualiza contadores (Arquivado +1, Caixa de Saída -1) sem reload.
 *  3) Excluir definitivamente (confirmar) remove do banco e da lista.
 *  4) Excluir definitivamente (cancelar) preserva o item e os contadores.
 */

const ME = { id: "user-me", email: "remetente@example.com" };

const baseRow = {
  id: "agd-1",
  user_id: ME.id,
  nome_associado: "REMETENTE",
  secao: "Tropa",
  dirigente: "Chefe",
  cargo_1: "", cargo_2: "",
  email_de: ME.email,
  email_para: "destinatario@example.com",
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
  recipient_response: "pendente" as "pendente" | "confirmado" | "recusado",
  recipient_response_reason: null,
  recipient_response_at: null,
  recipient_response_by: null,
};

let rows: any[] = [];
const archives: Array<{ user_id: string; agendamento_id: string; kind: string }> = [];

// Captura de handlers do realtime para disparar manualmente updates
const rtHandlers: Array<(payload: any) => void> = [];
const channelMock: any = {
  on: (_event: string, _filter: any, cb: (p: any) => void) => {
    rtHandlers.push(cb);
    return channelMock;
  },
  subscribe: () => channelMock,
};

vi.mock("@/integrations/supabase/client", () => {
  const buildArchivesQuery = () => {
    const filters: Record<string, string> = {};
    const exec = () =>
      Promise.resolve({
        data: archives.filter(r => Object.entries(filters).every(([k, v]) => (r as any)[k] === v)),
        error: null,
      });
    const chain: any = {
      eq: (k: string, v: string) => { filters[k] = v; return chain; },
      then: (resolve: any) => exec().then(resolve),
    };
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === "agendamentos") {
          return {
            select: () => ({
              order: () => Promise.resolve({ data: rows, error: null }),
              eq: (_k: string, id: string) => ({
                maybeSingle: () => Promise.resolve({ data: rows.find(r => r.id === id) ?? null, error: null }),
              }),
            }),
            delete: () => {
              const filters: Record<string, string> = {};
              const exec = () => {
                for (let i = rows.length - 1; i >= 0; i--) {
                  if (Object.entries(filters).every(([k, v]) => (rows[i] as any)[k] === v)) rows.splice(i, 1);
                }
                return Promise.resolve({ error: null });
              };
              const chain: any = {
                eq: (k: string, v: string) => { filters[k] = v; return chain; },
                then: (resolve: any) => exec().then(resolve),
              };
              return chain;
            },
          };
        }
        if (table === "branches") {
          return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
        }
        if (table === "agendamento_archives") {
          return {
            select: () => buildArchivesQuery(),
            insert: (row: any) => {
              archives.push({ kind: "archived", ...row });
              return Promise.resolve({ data: null, error: null });
            },
            delete: () => {
              const filters: Record<string, string> = {};
              const exec = () => {
                for (let i = archives.length - 1; i >= 0; i--) {
                  if (Object.entries(filters).every(([k, v]) => (archives[i] as any)[k] === v)) archives.splice(i, 1);
                }
                return Promise.resolve({ error: null });
              };
              const chain: any = {
                eq: (k: string, v: string) => { filters[k] = v; return chain; },
                then: (resolve: any) => exec().then(resolve),
              };
              return chain;
            },
          };
        }
        return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
      },
      channel: () => channelMock,
      removeChannel: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: ME, roles: [] }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/scoutUtils", () => ({ parseLocalDate: (s: string) => new Date(`${s}T00:00:00`) }));

import AgendamentosManager from "../AgendamentosManager";

const folderCount = (testId: string) => {
  const btn = screen.getByTestId(testId);
  const spans = btn.querySelectorAll("span");
  return Number(spans[spans.length - 1].textContent || "0");
};

const expandFirst = async () => {
  const opt = await screen.findByRole("option");
  fireEvent.click(opt);
};

beforeEach(() => {
  rows = [{ ...baseRow }];
  archives.length = 0;
  rtHandlers.length = 0;
  vi.clearAllMocks();
});

describe("AgendamentosManager — Arquivar/Lixeira E2E", () => {
  it("1) Arquivar desabilitado enquanto pendente, reabilita após resposta", async () => {
    render(<AgendamentosManager />);
    await waitFor(() => expect(screen.queryByText(/Carregando agendamentos/i)).toBeNull());

    fireEvent.click(screen.getByTestId("folder-sent"));
    await expandFirst();

    const archiveBtn = await screen.findByTestId("archive-btn-agd-1");
    expect(archiveBtn).toBeDisabled();

    // Simula realtime: destinatário confirmou
    const updated = { ...rows[0], recipient_response: "confirmado" };
    rows[0] = updated;
    rtHandlers.forEach(cb => cb({ new: updated, eventType: "UPDATE" }));

    await waitFor(() =>
      expect(screen.getByTestId("archive-btn-agd-1")).not.toBeDisabled()
    );
  });

  it("2) Arquivar atualiza contadores em tempo real (Saída -1, Arquivado +1)", async () => {
    rows = [{ ...baseRow, recipient_response: "confirmado" }];
    render(<AgendamentosManager />);
    await waitFor(() => expect(screen.queryByText(/Carregando agendamentos/i)).toBeNull());

    fireEvent.click(screen.getByTestId("folder-sent"));
    expect(folderCount("folder-sent")).toBe(1);
    expect(folderCount("folder-archived")).toBe(0);

    await expandFirst();
    fireEvent.click(await screen.findByTestId("archive-btn-agd-1"));

    await waitFor(() => expect(folderCount("folder-archived")).toBe(1));
    expect(folderCount("folder-sent")).toBe(0);
  });

  it("3) Excluir definitivamente (confirmar) remove do banco e da Lixeira", async () => {
    rows = [{ ...baseRow, recipient_response: "confirmado" }];
    render(<AgendamentosManager />);
    await waitFor(() => expect(screen.queryByText(/Carregando agendamentos/i)).toBeNull());

    fireEvent.click(screen.getByTestId("folder-sent"));
    await expandFirst();
    fireEvent.click(await screen.findByTestId("trash-btn-agd-1"));

    fireEvent.click(screen.getByTestId("folder-trash"));
    await waitFor(() => expect(folderCount("folder-trash")).toBe(1));
    await expandFirst();

    fireEvent.click(await screen.findByTestId("permanent-delete-btn-agd-1"));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /excluir/i }));

    await waitFor(() => expect(rows.length).toBe(0));
    await waitFor(() => expect(screen.queryByTestId("permanent-delete-btn-agd-1")).toBeNull());
    expect(folderCount("folder-trash")).toBe(0);
  });

  it("4) Excluir definitivamente (cancelar) preserva o item e os contadores", async () => {
    rows = [{ ...baseRow, recipient_response: "confirmado" }];
    render(<AgendamentosManager />);
    await waitFor(() => expect(screen.queryByText(/Carregando agendamentos/i)).toBeNull());

    fireEvent.click(screen.getByTestId("folder-sent"));
    await expandFirst();
    fireEvent.click(await screen.findByTestId("trash-btn-agd-1"));

    fireEvent.click(screen.getByTestId("folder-trash"));
    await waitFor(() => expect(folderCount("folder-trash")).toBe(1));
    await expandFirst();

    fireEvent.click(await screen.findByTestId("permanent-delete-btn-agd-1"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(rows.length).toBe(1);
    expect(folderCount("folder-trash")).toBe(1);
    expect(screen.getByTestId("permanent-delete-btn-agd-1")).toBeInTheDocument();
  });
});
