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
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'http://signed' }, error: null })),
        remove: vi.fn(() => Promise.resolve({ error: null })),
      })),
    },
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
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
      canUploadEventPhotos: true,
      canViewMinors: true,
    });

    // Mock branches call which happens on mount
    (supabase.from as any).mockImplementation((table: string) => {
        const query = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(() => {
                if (table === 'events') return Promise.resolve({ data: { id: 'event-123', name: 'Evento Teste', created_at: new Date().toISOString() }, error: null });
                return Promise.resolve({ data: null, error: null });
            }),
            then: vi.fn().mockImplementation((callback) => {
                if (table === 'branches') callback({ data: [{ id: 'branch-1', key: 'test', display_name: 'Teste', icon: '🌲' }], error: null });
                return Promise.resolve();
            })
        };
        return query;
    });
  });

  it("deve tentar abrir o link e registrar erro no console/audit se a URL for inválida", async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockImage = {
      id: 'img-external-1',
      filename: 'Link Inválido',
      media_type: 'document',
      external_url: 'invalid-url',
      created_at: new Date().toISOString(),
      user_id: 'user-123',
      views: 0
    };

    // Refined mock for the specific test case
    (supabase.from as any).mockImplementation((table: string) => {
      const query: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (table === 'events') return Promise.resolve({ data: { id: 'event-123', name: 'Evento Teste', created_at: new Date().toISOString() }, error: null });
          return Promise.resolve({ data: null, error: null });
        }),
        then: vi.fn().mockImplementation((callback) => {
          if (table === 'branches') callback({ data: [{ id: 'branch-1', key: 'test', display_name: 'Teste', icon: '🌲' }], error: null });
          return Promise.resolve();
        }),
        // Add more methods that EventDetail calls
        in: vi.fn().mockReturnThis(),
      };
      
      // Override eq().order() for images
      if (table === 'images') {
        query.eq = vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [mockImage], error: null })
        });
      }

      return query;
    });

    render(
      <MemoryRouter initialEntries={["/events/event-123"]}>
        <EventDetail />
      </MemoryRouter>
    );

    const mediaItem = await screen.findByTestId('media-item-img-external-1', {}, { timeout: 5000 });
    fireEvent.click(mediaItem);

    const openButton = await screen.findByText(/Abrir no Google Drive/i);
    fireEvent.click(openButton);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Google Drive] Erro crítico ao processar URL:'), expect.any(Error));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('O link salvo é inválido'));

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