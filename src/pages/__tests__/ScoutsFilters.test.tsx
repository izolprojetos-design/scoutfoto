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

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
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

    // Esperar os rótulos aparecerem
    await waitFor(() => {
      expect(screen.queryByText(/Filtros avançados/i)).not.toBeNull();
    }, { timeout: 2000 });

    // Verificar se os rótulos estão presentes e têm as classes de destaque
    const labels = [
      "Idade (anos)",
      "Tempo no grupo (mín. anos)",
      "Foto"
    ];
    
    for (const text of labels) {
      const label = screen.getByText(text);
      expect(label).toBeDefined();
      
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

    await waitFor(() => {
      expect(screen.queryByText(/Filtros avançados/i)).not.toBeNull();
    });

    const advancedFiltersHeader = screen.getByText(/Filtros avançados/i);
    // O PopoverContent é o elemento com data-side ou que contém a classe w-...
    const popoverContent = advancedFiltersHeader.closest('[class*="w-"]');
    
    expect(popoverContent?.className).toContain("w-[calc(100vw-32px)]");
    expect(popoverContent?.className).toContain("sm:w-80");
  });
});
