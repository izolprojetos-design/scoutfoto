import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventDetail from "@/pages/EventDetail";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table) => ({
      select: vi.fn((columns) => ({
        eq: vi.fn((col, val) => ({
          single: vi.fn(() => {
            if (table === 'global_settings' && val === 'google_drive_integration') {
              return Promise.resolve({ data: { value: { enabled: true, allowed_types: ['video', 'document'] } }, error: null });
            }
            if (table === 'events') {
              return Promise.resolve({ data: { id: 'event-123', branch_id: 'branch-1' }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
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

// Mock Hooks
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

// Mock Framer Motion to disable animations
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("EventDetail - Google Drive Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (useAuth as any).mockReturnValue({
      user: { id: "user-123" },
      roles: ['voluntario'],
      isAdmin: false,
    });

    (usePermissions as any).mockReturnValue({
      canManageGoogleDrive: true,
      canAddDriveImages: false,
      canAddDriveVideos: false,
      canAddDriveDocuments: false,
    });
  });

  it("deve bloquear a inserção de link de foto quando o tipo está desativado globalmente", async () => {
    render(
      <MemoryRouter initialEntries={["/events/event-123"]}>
        <EventDetail />
      </MemoryRouter>
    );

    // Wait for the page to load
    await waitFor(() => {
      expect(screen.queryByText(/Adicionar Link/i) || screen.queryByText(/Vincular/i)).not.toBeNull();
    });

    // Find and click the button to add external link
    // Assuming the button has text "Adicionar Link" or similar
    const addButton = screen.getByText(/Vincular Material/i) || screen.getByText(/Adicionar Link/i);
    fireEvent.click(addButton);

    // Fill the form
    const urlInput = screen.getByPlaceholderText(/https:\/\/.../i);
    fireEvent.change(urlInput, { target: { value: 'https://drive.google.com/file/d/123/view' } });

    const titleInput = screen.getByPlaceholderText(/Título do material/i);
    fireEvent.change(titleInput, { target: { value: 'Teste Foto' } });

    // Select 'Foto' type (usually a radio or select)
    // For simplicity, we assume it's already selected or we find it
    // In many of these apps, it's a grid of buttons
    const photoTypeButton = screen.getByText(/Foto/i);
    fireEvent.click(photoTypeButton);

    // Click 'Salvar'
    const saveButton = screen.getByText(/Salvar Material/i) || screen.getByText(/Salvar/i);
    fireEvent.click(saveButton);

    // Check toast error
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Acesso Negado: O administrador desativou a inclusão de Links de Foto"));
    });

    // Check audit log RPC
    expect(supabase.rpc).toHaveBeenCalledWith('log_audit', expect.objectContaining({
      _action: 'access_denied',
      _details: expect.objectContaining({
        reason: 'type_blocked',
        type: 'image',
        event_id: 'event-123'
      })
    }));
  });
});
