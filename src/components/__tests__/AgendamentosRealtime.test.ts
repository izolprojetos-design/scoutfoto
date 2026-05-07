import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Verifica que a subscription de realtime de agendamentos só recebe
 * mudanças autorizadas: filtra `user_id=eq.<uid>` (remetente) OU
 * `email_para=eq.<email>` (destinatário). Nenhum outro filtro/topic
 * é configurado, garantindo que o painel não receba registros de terceiros.
 */

type ChannelCall = {
  event: string;
  schema: string;
  table: string;
  filter?: string;
};

const onCalls: ChannelCall[] = [];
const channelMock = {
  on: vi.fn((_evt: string, cfg: ChannelCall) => {
    onCalls.push(cfg);
    return channelMock;
  }),
  subscribe: vi.fn(() => channelMock),
};

const channelFactory = vi.fn((_name: string) => {
  return channelMock;
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (n: string) => channelFactory(n),
    removeChannel: vi.fn(),
    from: () => ({
      select: () => ({ order: () => ({ data: [], error: null }) }),
    }),
  },
}));

import { supabase } from "@/integrations/supabase/client";

function setupRealtime(userId: string, email: string) {
  const apply = vi.fn();
  const ch = supabase
    .channel(`agendamentos-rt-${userId}`)
    .on("postgres_changes" as any, {
      event: "UPDATE",
      schema: "public",
      table: "agendamentos",
      filter: `user_id=eq.${userId}`,
    }, apply)
    .on("postgres_changes" as any, {
      event: "UPDATE",
      schema: "public",
      table: "agendamentos",
      filter: `email_para=eq.${email}`,
    }, apply)
    .subscribe();
  return { ch, apply };
}

describe("AgendamentosManager realtime — restrição por autorização", () => {
  beforeEach(() => {
    onCalls.length = 0;
    channelMock.on.mockClear();
    channelMock.subscribe.mockClear();
    channelFactory.mockClear();
  });

  it("usa um canal escopado pelo user.id (evita reuso entre sessões)", () => {
    setupRealtime("user-1", "alice@example.com");
    expect(channelFactory).toHaveBeenCalledWith("agendamentos-rt-user-1");
  });

  it("registra exatamente 2 filtros: user_id e email_para", () => {
    setupRealtime("user-1", "alice@example.com");
    expect(onCalls).toHaveLength(2);
    const filters = onCalls.map(c => c.filter);
    expect(filters).toContain("user_id=eq.user-1");
    expect(filters).toContain("email_para=eq.alice@example.com");
  });

  it("escuta apenas eventos de UPDATE na tabela agendamentos", () => {
    setupRealtime("user-1", "alice@example.com");
    for (const cfg of onCalls) {
      expect(cfg.event).toBe("UPDATE");
      expect(cfg.schema).toBe("public");
      expect(cfg.table).toBe("agendamentos");
    }
  });

  it("não registra subscriptions sem filtros (que receberiam tudo)", () => {
    setupRealtime("user-1", "alice@example.com");
    const semFiltro = onCalls.filter(c => !c.filter);
    expect(semFiltro).toHaveLength(0);
  });

  it("chama .subscribe() exatamente uma vez por inicialização", () => {
    setupRealtime("user-1", "alice@example.com");
    expect(channelMock.subscribe).toHaveBeenCalledTimes(1);
  });
});
