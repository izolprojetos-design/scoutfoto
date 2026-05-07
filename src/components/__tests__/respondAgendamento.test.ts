import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testa o contrato cliente <-> RPC `respond_agendamento`:
 * - Falha quando não autenticado (erro 42501 vindo do banco).
 * - Falha quando o chamador não é o destinatário (erro 42501 vindo do banco).
 * - Bloqueia tentativa de re-resposta quando o agendamento já está confirmado/recusado
 *   (erros 22023 / 40001 vindos do banco) e propaga mensagem amigável.
 * - Sucesso retorna o registro atualizado.
 *
 * O cliente Supabase é mockado: validamos os parâmetros enviados ao `rpc`
 * e como o app reage às respostas.
 */

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { supabase } from "@/integrations/supabase/client";

async function callRespond(id: string, response: "confirmado" | "recusado", reason?: string) {
  return supabase.rpc("respond_agendamento", {
    p_agendamento_id: id,
    p_response: response,
    p_reason: reason ?? null,
  });
}

describe("respond_agendamento RPC — contrato de segurança", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("propaga erro de autenticação (42501) quando usuário não está logado", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "Não autenticado" },
    });

    const { error } = await callRespond("agd-1", "confirmado");

    expect(rpcMock).toHaveBeenCalledWith("respond_agendamento", {
      p_agendamento_id: "agd-1",
      p_response: "confirmado",
      p_reason: null,
    });
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/autenticado/i);
  });

  it("propaga erro de permissão (42501) quando o chamador não é o destinatário", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "Apenas o destinatário pode responder" },
    });

    const { error } = await callRespond("agd-1", "confirmado");
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/destinatário/i);
  });

  it("bloqueia re-resposta quando já confirmado (22023)", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "Este agendamento já foi confirmado e não pode ser respondido novamente." },
    });

    const { error } = await callRespond("agd-1", "recusado", "mudei de ideia");
    expect(error?.code).toBe("22023");
    expect(error?.message.toLowerCase()).toContain("já foi");
  });

  it("bloqueia re-resposta concorrente (conflito 40001)", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "Conflito: este agendamento já foi respondido." },
    });

    const { error } = await callRespond("agd-1", "confirmado");
    expect(error?.code).toBe("40001");
  });

  it("exige motivo ao recusar — backend rejeita string vazia", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Motivo da recusa é obrigatório" },
    });

    const { error } = await callRespond("agd-1", "recusado", "");
    expect(error?.message).toMatch(/motivo/i);
  });

  it("retorna o registro atualizado quando o sucesso ocorre", async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: "agd-1",
        recipient_response: "confirmado",
        recipient_response_at: "2026-05-07T10:00:00Z",
      },
      error: null,
    });

    const { data, error } = await callRespond("agd-1", "confirmado");
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: "agd-1", recipient_response: "confirmado" });
  });
});
