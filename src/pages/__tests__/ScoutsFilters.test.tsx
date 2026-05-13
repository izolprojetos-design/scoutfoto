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
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      on: vi.fn(() => ({ subscribe: vi.fn() })),
      removeChannel: vi.fn(),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
    })),
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

describe("Scouts Page - Filtros Avançados Responsividade", () => {
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

  it("deve exibir os rótulos dos filtros com as classes de estilo corretas", async () => {
    render(
      <MemoryRouter>
        <Scouts />
      </MemoryRouter>
    );

    // Abrir o popover de filtros
    const filterButton = screen.getByRole("button", { name: /Filtros/i });
    fireEvent.click(filterButton);

    // Verificar se os rótulos estão presentes e têm as classes de destaque
    // Nota: Label do Radix UI renderiza como label HTML
    const labels = ["SEÇÃO", "EQUIPE", "IDADE (ANOS)", "TEMPO NO GRUPO (MÍN. ANOS)", "FOTO"];
    
    for (const text of labels) {
      const label = screen.getByText(new RegExp(text, "i"));
      expect(label).toBeDefined();
      
      // Verificar classes de destaque (font-black, text-primary, drop-shadow-sm)
      // Também verificamos o text-[10px] sm:text-[11px] que adicionamos para responsividade
      const className = label.className;
      expect(className).toContain("font-black");
      expect(className).toContain("text-primary");
      expect(className).toContain("drop-shadow-sm");
      expect(className).toContain("text-[10px]");
      expect(className).toContain("sm:text-[11px]");
    }
  });

  it("deve ter a largura responsiva no PopoverContent", async () => {
    render(
      <MemoryRouter>
        <Scouts />
      </MemoryRouter>
    );

    const filterButton = screen.getByRole("button", { name: /Filtros/i });
    fireEvent.click(filterButton);

    // O PopoverContent deve ter a classe w-[calc(100vw-32px)] sm:w-80
    // Procuramos pelo container dos filtros
    const advancedFiltersHeader = screen.getByText(/Filtros avançados/i);
    const popoverContent = advancedFiltersHeader.closest('[class*="w-[calc(100vw-32px)]"]');
    
    expect(popoverContent).not.toBeNull();
    expect(popoverContent?.className).toContain("sm:w-80");
  });
});
