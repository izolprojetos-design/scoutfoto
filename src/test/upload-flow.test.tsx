import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Scouts from '../pages/Scouts';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';

// Mock Supabase
vi.mock('../integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnData([]),
      update: vi.fn().mockReturnData({}),
      insert: vi.fn().mockReturnData({}),
      delete: vi.fn().mockReturnData({}),
      order: vi.fn().mockReturnData([]),
      eq: vi.fn().mockReturnData([]),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'mock-url' }, error: null }),
      })),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock Auth Context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { email: 'test@example.com' },
    isAdmin: true,
    isVoluntario: false,
    canUpload: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Smartphone Upload Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should maintain the screen open during photo upload and show progress', async () => {
    const mockScout = {
      id: 'scout-123',
      name: 'TEST INTEGRANTE',
      photo_url: null,
      birth_date: '2010-01-01',
      scout_group: 'Group',
      is_active: true,
    };

    // Mock initial data load
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'scouts') {
        return {
          select: vi.fn().mockResolvedValue({ data: [mockScout], error: null }),
          order: vi.fn().mockReturnThis(),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }), order: vi.fn().mockThis() };
    });

    render(
      <BrowserRouter>
        <Scouts />
      </BrowserRouter>
    );

    // 1. Open Photos Hub
    const photosBtn = await screen.findByRole('button', { name: /fotos/i });
    fireEvent.click(photosBtn);

    // 2. Select Scout
    const scoutBtn = await screen.findByText(/TEST INTEGRANTE/i);
    fireEvent.click(scoutBtn);

    // 3. Mock file selection (simulating camera capture)
    const file = new File(['dummy content'], 'test-photo.jpg', { type: 'image/jpeg' });
    
    // We need to find the input in ScoutGallery or ScoutFolders
    // Since they are inside Tabs, let's find the Add Photos button
    const addPhotosBtn = await screen.findByRole('button', { name: /adicionar fotos/i });
    
    // Mock the file input change
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    // 4. Confirm Alert Dialog should appear
    const confirmBtn = await screen.findByRole('button', { name: /confirmar e salvar/i });
    expect(confirmBtn).toBeInTheDocument();

    // 5. Click confirm and check if progress bar appears and screen stays open
    fireEvent.click(confirmBtn);

    // Check for progress message
    await waitFor(() => {
      expect(screen.getByText(/enviando foto 1 de 1/i)).toBeInTheDocument();
    });

    // Ensure the dialog is still open (integration test for "a tela não feche")
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
