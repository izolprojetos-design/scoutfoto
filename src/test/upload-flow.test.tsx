import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Scouts from '../pages/Scouts';
import { BrowserRouter } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { format } from 'date-fns';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, animate, initial }: any) => (
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

// Mock Supabase with event emission capabilities
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

describe('Smartphone E2E Simulation: Capture and Realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtimeCallback = null;
  });

  it('verifies the full flow: capture, progress, naming, and realtime update', async () => {
    render(
      <BrowserRouter>
        <Scouts />
      </BrowserRouter>
    );

    // 1. Simular abertura do Fotos Hub
    // Use wait for para garantir que os dados carregaram e o botão apareceu
    const photosBtn = await screen.findByRole('button', { name: /fotos/i });
    fireEvent.click(photosBtn);

    // 2. Selecionar o integrante
    const scoutItem = await screen.findByText(/MARIA SILVA/i);
    fireEvent.click(scoutItem);

    // 3. Simular captura de múltiplas fotos (sequência)
    const file1 = new File(['image1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['image2'], 'photo2.jpg', { type: 'image/jpeg' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Upload da primeira foto
    Object.defineProperty(input, 'files', { value: [file1], configurable: true });
    fireEvent.change(input);

    // Verificar se o diálogo de confirmação abriu (a tela NÃO fecha)
    const confirmBtn = await screen.findByRole('button', { name: /confirmar e salvar/i });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 4. Clicar em confirmar e verificar progresso e padrão de nome
    fireEvent.click(confirmBtn);
    
    // Verificar status de progresso
    expect(await screen.findByText(/enviando foto 1 de 1/i)).toBeInTheDocument();
    
    // Verificar se o caminho Ano > Data aparece no status
    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(currentYear, 'i'))).toBeInTheDocument();

    // 5. Verificar Realtime (Auto-update)
    // O mock do supabase.insert já dispara o realtimeCallback
    await waitFor(() => {
      // Verifica se o componente tentou recarregar dados (Supabase.from chamado novamente para fotos)
      expect(supabase.from).toHaveBeenCalledWith('scout_photos');
    }, { timeout: 2000 });

    // 6. Validar padrão de nome (Verificando a chamada de upload)
    const uploadCall = vi.mocked(supabase.storage.from('scout-photos').upload);
    const uploadedPath = uploadCall.mock.calls[0][0];
    
    // Padrão: gallery/ID/ANO/DATA/NOME_DATA_HORA_SUFIXO.ext
    expect(uploadedPath).toContain('MARIA_SILVA_');
    expect(uploadedPath).toContain(format(new Date(), 'yyyy-MM-dd'));
    
    // 7. Teste de Cancelamento
    const cancelBtn = await screen.findByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelBtn);
    
    // A tela de diálogo deve fechar somente após a conclusão do processo pelo usuário ou remoção do estado pendente
    await waitFor(() => {
      expect(screen.queryByText(/enviando foto/i)).not.toBeInTheDocument();
    });
  });

  it('handles upload errors and allows retry of individual failed files', async () => {
    vi.mocked(supabase.storage.from('scout-photos').upload).mockRejectedValueOnce(new Error('Falha de conexão'));

    render(
      <BrowserRouter>
        <Scouts />
      </BrowserRouter>
    );

    const photosBtn = await screen.findByRole('button', { name: /fotos/i });
    fireEvent.click(photosBtn);
    const scoutItem = await screen.findByText(/MARIA SILVA/i);
    fireEvent.click(scoutItem);

    const file = new File(['image'], 'error-test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    const confirmBtn = await screen.findByRole('button', { name: /confirmar e salvar/i });
    fireEvent.click(confirmBtn);

    // Deve mostrar mensagem de erro com acessibilidade
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/falha de conexão/i)).toBeInTheDocument();
    
    // Deve permitir tentar novamente apenas a foto que falhou
    const retryBtn = screen.getByRole('button', { name: /tentar foto/i });
    expect(retryBtn).toBeInTheDocument();
    
    // Diálogo ainda deve estar aberto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('validates naming collision and sequential pattern', async () => {
    render(
      <BrowserRouter>
        <Scouts />
      </BrowserRouter>
    );

    const photosBtn = await screen.findByRole('button', { name: /fotos/i });
    fireEvent.click(photosBtn);
    const scoutItem = await screen.findByText(/MARIA SILVA/i);
    fireEvent.click(scoutItem);

    const file1 = new File(['1'], 'f1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['2'], 'f2.jpg', { type: 'image/jpeg' });
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file1, file2], configurable: true });
    fireEvent.change(input);

    const confirmBtn = await screen.findByRole('button', { name: /confirmar e salvar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.storage.from('scout-photos').upload).toHaveBeenCalledTimes(2);
    });

    const calls = vi.mocked(supabase.storage.from('scout-photos').upload).mock.calls;
    // O sufixo de índice (0 e 1) deve evitar colisões
    expect(calls[0][0]).toMatch(/_0\.jpg$/);
    expect(calls[1][0]).toMatch(/_1\.jpg$/);
  });
});
