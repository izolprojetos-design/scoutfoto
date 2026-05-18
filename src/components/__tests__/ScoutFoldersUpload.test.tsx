import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ScoutFolders from '../ScoutFolders';
import { supabase } from '@/integrations/supabase/client';
import '@testing-library/jest-dom';
import { xhrUploadToStorage } from '@/lib/uploadUtils';

// Global mocks for JSDOM
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'mock-url');
  window.URL.revokeObjectURL = vi.fn();
  
  window.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      then: vi.fn((cb) => cb({ data: [], error: null })),
    })),
    storage: {
      from: vi.fn(() => ({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        upload: vi.fn().mockResolvedValue({ data: { id: 'f', path: 'p', fullPath: 'fp' }, error: null }),
      })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'fake-token' } }, error: null }),
    },
  },
}));

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    isAdmin: true,
    isVoluntario: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock image compression
vi.mock('@/lib/imageCompression', () => ({
  compressImage: vi.fn((file) => Promise.resolve(file)),
}));

// Mock storageUtils
vi.mock('@/lib/storageUtils', () => ({
  getSignedUrlsBatch: vi.fn(() => Promise.resolve({})),
}));

// Mock uploadUtils
vi.mock('@/lib/uploadUtils', () => ({
  xhrUploadToStorage: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

describe('ScoutFolders Upload Flow', () => {
  const mockProps = {
    scoutId: 'scout-123',
    scoutName: 'Scout Test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('innerHeight', 667);
  });

  it('announces upload status and file name using aria-live in correct order', async () => {
    vi.mocked(xhrUploadToStorage).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
    render(<ScoutFolders {...mockProps} />);
    
    const file1 = new File(['c1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['c2'], 'photo2.jpg', { type: 'image/jpeg' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [file1, file2] } });

    fireEvent.click(await screen.findByText(/Confirmar e enviar/i));

    // Wait for the status region
    const statusRegion = await screen.findByText(/Enviando 1 de 2/i);
    const parent = statusRegion.closest('[aria-live="polite"]');
    expect(parent).toBeInTheDocument();
    
    // Check specific file name inside the live region to avoid ambiguity with the file list
    expect(within(parent as HTMLElement).getByText('photo1.jpg')).toBeInTheDocument();

    await waitFor(() => {
      expect(within(parent as HTMLElement).getByText(/Enviando 2 de 2/i)).toBeInTheDocument();
      expect(within(parent as HTMLElement).getByText('photo2.jpg')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('updates progressbar attributes (valuenow/min/max) and label correctly after each photo', async () => {
    vi.mocked(xhrUploadToStorage).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
    render(<ScoutFolders {...mockProps} />);
    
    const file1 = new File(['c1'], 'photo1.jpg', { type: 'image/jpeg' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [file1] } });

    fireEvent.click(await screen.findByText(/Confirmar e enviar/i));

    const progressBar = await screen.findByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    
    await waitFor(() => {
      const value = parseInt(progressBar.getAttribute('aria-valuenow') || '0');
      expect(value).toBeGreaterThanOrEqual(0);
      expect(progressBar).toHaveAttribute('aria-label', expect.stringContaining('Progresso total'));
    });
  });

  it('fails specific photos deterministically and retries only the failed ones', async () => {
    let callCount = 0;
    vi.mocked(xhrUploadToStorage).mockImplementation(() => {
      callCount++;
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (callCount === 1) {
            reject(new Error('Simulated failure'));
          } else {
            resolve();
          }
        }, 50);
      });
    });


    render(<ScoutFolders {...mockProps} />);
    
    const file1 = new File(['c1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['c2'], 'photo2.jpg', { type: 'image/jpeg' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [file1, file2] } });

    fireEvent.click(await screen.findByText(/Confirmar e enviar/i));

    // Wait for upload loop to finish and show retry button
    // Increase timeout to ensure loop finishes
    const retryBtn = await screen.findByText(/Tentar novamente 1 falha/i, {}, { timeout: 5000 });
    expect(retryBtn).toBeInTheDocument();

    // Success for retry
    vi.mocked(xhrUploadToStorage).mockResolvedValue(undefined);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Tentar novamente/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('verifies that Escape key closes confirmation dialog but main dialog stays', async () => {
    // Keep it uploading forever
    vi.mocked(xhrUploadToStorage).mockImplementation(() => new Promise(() => {}));
    render(<ScoutFolders {...mockProps} />);
    
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelectorAll('input[type="file"]')[0], { target: { files: [file] } });

    fireEvent.click(await screen.findByText(/Confirmar e enviar/i));

    // Open confirmation
    const cancelBtn = await screen.findByText(/Cancelar upload/i);
    fireEvent.click(cancelBtn);

    const alertDialog = await screen.findByRole('alertdialog');
    expect(alertDialog).toBeInTheDocument();

    // Use a more generic fireEvent for Escape on the element that usually has focus
    const stayBtn = screen.getByText(/Não, continuar/i);
    fireEvent.keyDown(stayBtn, { key: 'Escape', code: 'Escape', keyCode: 27, which: 27 });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Main dialog should persist
    expect(screen.getByText(/Enviar fotos para/i)).toBeInTheDocument();
  });
});
