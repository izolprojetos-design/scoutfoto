import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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
  default: () => <div data-testid="agendamentos-manager" />,
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

describe("Renomeação Mensagem", () => {
  it("sidebar exibe 'Mensagem' apontando para /agendamentos e marca como ativo", () => {
    render(
      <MemoryRouter initialEntries={["/agendamentos"]}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /Mensagem/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/agendamentos");
    // NavLink active class is applied via aria-current or "active" — react-router sets aria-current="page"
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("página /agendamentos mostra cabeçalho 'Mensagem' e atualiza document.title", () => {
    render(
      <MemoryRouter initialEntries={["/agendamentos"]}>
        <MyAgendamentos />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mensagem");
    expect(document.title).toContain("Mensagem");
  });
});
