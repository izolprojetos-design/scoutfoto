import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Scouts from "@/pages/Scouts";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      on: vi.fn(() => ({ subscribe: vi.fn() })),
      removeChannel: vi.fn(),
      update: vi.fn(() => Promise.resolve({ error: null })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => Promise.resolve({ error: null })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
        createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: "" }, error: null })),
      })),
    },
  },
}));

// Mock Auth Context
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock Permissions Hook
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: vi.fn(),
}));

// Mock Sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe("Scouts Page - Data da Passagem", () => {
  beforeEach(() => {
    (useAuth as any).mockReturnValue({
      user: { id: "123" },
      isAdmin: true,
      isVoluntario: false,
      canUpload: true,
    });

    (usePermissions as any).mockReturnValue({
      canManageScouts: true,
      canEditScouts: true,
      canViewGuardians: true,
    });
  });

  it("deve exibir o campo 'Data da Passagem' no formulário de cadastro abaixo do seletor de Equipe", async () => {
    render(
      <MemoryRouter>
        <Scouts />
      </MemoryRouter>
    );

    // Abrir o dialog de cadastro
    const addButton = await waitFor(() => screen.getByRole("button", { name: /Novo Integrante/i }));
    fireEvent.click(addButton);

    // Aguardar o dialog abrir
    await waitFor(() => {
      expect(screen.queryByText(/Cadastrar Membro/i)).not.toBeNull();
    });

    // Verificar se o label e o input de Data da Passagem estão presentes
    const label = screen.getByText("Data da Passagem");
    expect(label).toBeDefined();

    const dateInput = screen.getByLabelText("Data da Passagem");
    expect(dateInput).toBeDefined();
    expect(dateInput.getAttribute("type")).toBe("date");
  });
});
