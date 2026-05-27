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
      select: vi.fn(() => ({
        eq: vi.fn((col, val) => ({
          single: vi.fn(() => {
            if (table === 'events') {
              return Promise.resolve({ data: { id: 'event-123', name: 'Evento Teste', created_at: new Date().toISOString() }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'http://test-url' }, error: null })),
        })),
      },
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
      channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn() })) })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("Google Drive Click Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (useAuth as any).mockReturnValue({
      user: { id: "user-123" },
      isAdmin: false,
    });

    (usePermissions as any).mockReturnValue({
      canManageGoogleDrive: true,
    });
  });

  it("deve tentar abrir o link e registrar erro no console/audit se a URL for inválida", async () => {
    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup images data to include an external link with invalid URL
    const mockImage = {
      id: 'img-external-1',
      filename: 'Link Inválido',
      media_type: 'document',
      external_url: 'invalid-url', // Not a valid URL
      created_at: new Date().toISOString(),
      user_id: 'user-123',
      views: 0
    };

    // Re-mock supabase to return our mock image
    (supabase.from as any).mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => {
            if (table === 'events') return Promise.resolve({ data: { id: 'event-123' }, error: null });
            return Promise.resolve({ data: null, error: null });
          }),
          order: vi.fn(() => {
             if (table === 'images') return Promise.resolve({ data: [mockImage], error: null });
             return Promise.resolve({ data: [], error: null });
          })
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'http://signed' }, error: null }))
        }))
      },
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }));

    render(
      <MemoryRouter initialEntries={["/events/event-123"]}>
        <EventDetail />
      </MemoryRouter>
    );

    // Find the media item and click it to open the viewer
    const mediaItem = await screen.findByTestId('media-item-img-external-1');
    fireEvent.click(mediaItem);

    // Find the "Abrir no Google Drive" button in the dialog and click it
    const openButton = await screen.findByText(/Abrir no Google Drive/i);
    fireEvent.click(openButton);

    // Verify error was logged and toast was shown
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Google Drive] Erro crítico ao processar URL:'), expect.any(Error));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('O link salvo é inválido'));

    // Verify audit log was recorded
    expect(supabase.rpc).toHaveBeenCalledWith('log_audit', expect.objectContaining({
      _action: 'access_denied',
      _image_id: 'img-external-1',
      _details: expect.objectContaining({
        reason: 'invalid_url_format',
        step: 'url-parsing'
      })
    }));

    consoleSpy.mockRestore();
  });
});