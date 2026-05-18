import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Scouts from '../pages/Scouts';
import { BrowserRouter } from 'react-router-dom';
import { format } from 'date-fns';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, animate }: any) => (
      <div className={className} style={{ ...style, width: animate?.width }} data-testid="motion-div">
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Setup mock data
const mockScout = {
  id: 'scout-123',
  name: 'MARIA SILVA',
  photo_url: null,
  birth_date: '2015-05-10',
  scout_group: 'G.E. Teste',
  is_active: true,
  created_at: new Date().toISOString(),
};

const mockPhoto = {
  id: 'photo-456',
  scout_id: 'scout-123',
  storage_path: `gallery/scout-123/${new Date().getFullYear()}/${format(new Date(), 'yyyy-MM-dd')}/MARIA_SILVA_test.jpg`,
  caption: '',
  uploaded_by: 'test-user',
  created_at: new Date().toISOString(),
  file_size: 1024,
  mime_type: 'image/jpeg',
  is_favorite: false,
};

// Mock Supabase
let realtimeCallback: any = null;

vi.mock('../integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation(() => {
        if (realtimeCallback) setTimeout(() => realtimeCallback({}), 50);
        return Promise.resolve({ data: [mockPhoto], error: null });
      }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockScout, error: null }),
      then: (cb: any) => {
        if (table === 'scouts') return Promise.resolve(cb({ data: [mockScout], error: null }));
        if (table === 'scout_photos') return Promise.resolve(cb({ data: [mockPhoto], error: null }));
        return Promise.resolve(cb({ data: [], error: null }));
      },
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'mock-url' }, error: null }),
        createSignedUrls: vi.fn().mockResolvedValue({ data: [{ signedUrl: 'mock-url', path: mockPhoto.storage_path }], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockImplementation((event, filter, cb) => {
        realtimeCallback = cb;
        return { subscribe: vi.fn().mockReturnThis() };
      }),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Mock Auth Context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { name: 'Admin' },
    roles: ['admin'],
    isAdmin: true,
    isVoluntario: false,
    canUpload: true,
  }),
}));

describe('Upload Flow E2E Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupUpload = async () => {
    render(
      <BrowserRouter>
        <Scouts />
      </BrowserRouter>
    );

    // Wait for data to load and button to be enabled/clickable
    const photosBtn = await screen.findByTestId('photos-hub-trigger');
    fireEvent.click(photosBtn);
    
    // Wait for the modal/overlay to process and show the scout item
    const scoutItem = await screen.findByTestId('scout-item-name');
    fireEvent.click(scoutItem);

    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    const confirmBtn = await screen.findByRole('button', { name: /confirmar e salvar/i });
    fireEvent.click(confirmBtn);
  };

  it('validates cancellation dialog focus and behavior', async () => {
    await setupUpload();

    // Diálogo de progresso deve estar visível
    const cancelBtn = await screen.findByRole('button', { name: /cancelar/i }, { timeout: 5000 });
    fireEvent.click(cancelBtn);

    // Diálogo de confirmação de cancelamento deve aparecer
    const dialogTitle = await screen.findByText(/cancelar upload\?/i);
    expect(dialogTitle).toBeInTheDocument();

    // O botão de ação (Sim, cancelar) deve ter foco (autoFocus implementado)
    const confirmCancelBtn = screen.getByRole('button', { name: /sim, cancelar/i });
    expect(document.activeElement).toBe(confirmCancelBtn);

    // Pressionar Escape deve fechar o diálogo de confirmação
    fireEvent.keyDown(confirmCancelBtn, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByText(/cancelar upload\?/i)).not.toBeInTheDocument());

    // O upload ainda deve estar ocorrendo (barra de progresso visível)
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('validates accessibility attributes of the progress bar', async () => {
    await setupUpload();

    const progressBar = await screen.findByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    
    // Status deve ser anunciado
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
