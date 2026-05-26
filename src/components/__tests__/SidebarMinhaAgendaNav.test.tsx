import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    profile: { name: "Test User" },
    roles: ["voluntario"],
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    canViewPhotos: true,
    canViewEvents: true,
    canViewScouts: true,
    canAccessAdmin: false,
  }),
}));

vi.mock("@/components/AgendamentosManager", () => ({
  default: () => <div data-testid="agendamentos-manager">Agendamentos</div>,
}));

vi.mock("@/components/SchedulingRequestForm", () => ({
  default: () => <div data-testid="scheduling-form" />,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

import AppSidebar from "@/components/AppSidebar";
import MyAgendamentos from "@/pages/MyAgendamentos";
import { SidebarProvider } from "@/components/ui/sidebar";

const LocationProbe = () => {
  const loc = useLocation();
  return <div data-testid="route">{loc.pathname}</div>;
};

describe("Sidebar → /agendamentos navegação completa", () => {
  it("clicar em 'Mensagem' navega para /agendamentos, marca ativo e atualiza meta tags", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SidebarProvider>
          <div style={{ display: "flex" }}>
            <AppSidebar />
            <div>
              <LocationProbe />
              <Routes>
                <Route path="/dashboard" element={<div>Início</div>} />
                <Route path="/agendamentos" element={<MyAgendamentos />} />
              </Routes>
            </div>
          </div>
        </SidebarProvider>
      </MemoryRouter>
    );

    // Abrir o menu Central de Eventos primeiro
    const trigger = screen.getByRole("button", { name: /Central de Eventos/i });
    fireEvent.click(trigger);

    const link = screen.getByRole("link", { name: /Mensagem/i });
    expect(link.getAttribute("href")).toBe("/agendamentos");

    fireEvent.click(link);

    await waitFor(() => {
      expect(screen.getByTestId("route").textContent).toBe("/agendamentos");
    });

    // Cabeçalho da página
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mensagem");

    // Item ativo destaca a rota correta
    const activeLink = screen.getByRole("link", { name: /Mensagem/i });
    expect(activeLink.getAttribute("aria-current")).toBe("page");

    // Meta tags
    await waitFor(() => {
      expect(document.title).toBe("Mensagem | ScoutFoto");
    });
    const og = document.head.querySelector('meta[property="og:title"]');
    expect(og?.getAttribute("content")).toBe("Mensagem | ScoutFoto");
    const tw = document.head.querySelector('meta[name="twitter:title"]');
    expect(tw?.getAttribute("content")).toBe("Mensagem | ScoutFoto");
  });
});
