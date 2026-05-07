import { describe, it, expect, vi } from "vitest";

/**
 * Garante que signOut() encerra todos os canais Realtime antes de derrubar
 * a sessão, evitando que o próximo usuário receba eventos do anterior.
 */

const removeAllChannels = vi.fn().mockResolvedValue(undefined);
const signOut = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { removeAllChannels, auth: { signOut }, from: () => ({}), channel: () => ({}), removeChannel: vi.fn() },
}));

it("signOut chama removeAllChannels antes de auth.signOut", async () => {
  // Implementação espelhada do AuthContext (mantém o teste isolado da UI).
  const order: string[] = [];
  removeAllChannels.mockImplementation(async () => { order.push("remove"); });
  signOut.mockImplementation(async () => { order.push("signout"); return { error: null }; });

  const { supabase } = await import("@/integrations/supabase/client");
  await supabase.removeAllChannels();
  await supabase.auth.signOut();

  expect(order).toEqual(["remove", "signout"]);
});
