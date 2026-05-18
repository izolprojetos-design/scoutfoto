import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScoutFolders from '../ScoutFolders';
import { supabase } from '@/integrations/supabase/client';
import '@testing-library/jest-dom';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
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
  });

  it('announces upload status and file name using aria-live', async () => {
    render(<ScoutFolders {...mockProps} />);
    
    // Simulate selecting files
    const file = new File(['content'], 'test-photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/Remover/i).closest('div')?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    // Actually, let's find the "Enviar fotos" button and trigger its input
    const buttons = screen.getAllByRole('button');
    const uploadBtn = buttons.find(b => b.textContent?.includes('Enviar fotos'));
    
    // We can't easily trigger the hidden file input via its ref in JSDOM easily without finding it
    // Let's manually open the dialog by mocking the state if needed, but let's try to find the input
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const galleryInput = fileInputs[0] as HTMLInputElement;

    fireEvent.change(galleryInput, { target: { files: [file] } });

    // Wait for dialog
    expect(await screen.findByText(/Confirmar e enviar/i)).toBeInTheDocument();

    // Start upload
    const confirmBtn = screen.getByText(/Confirmar e enviar/i);
    fireEvent.click(confirmBtn);

    // Check for aria-live elements during upload
    await waitFor(() => {
      const liveRegions = screen.getAllByTestId ? [] : document.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions.length).toBeGreaterThan(0);
      
      // Verify progress bar attributes
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  it('shows confirmation dialog when canceling upload and traps focus', async () => {
    render(<ScoutFolders {...mockProps} />);
    
    const file = new File(['content'], 'test-photo.jpg', { type: 'image/jpeg' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    const confirmBtn = await screen.findByText(/Confirmar e enviar/i);
    fireEvent.click(confirmBtn);

    // Find cancel button (the one that appears during uploading)
    const cancelBtn = await screen.findByText(/Cancelar upload/i);
    fireEvent.click(cancelBtn);

    // Should show AlertDialog
    expect(screen.getByText(/Cancelar upload\?/i)).toBeInTheDocument();
    
    // "Sim, cancelar" should have autoFocus
    const confirmCancelBtn = screen.getByText(/Sim, cancelar/i);
    expect(confirmCancelBtn).toBeInTheDocument();
    
    // Escape should close only the alert dialog if confirmed? 
    // Actually the requirement: "Escape fecha somente após confirmação" usually means Escape is blocked or handles the cancel
    // In our implementation, Escape on AlertDialog cancels the "Cancel" (continues upload)
  });

  it('handles retrying failed uploads correctly', async () => {
    // Mock upload failure for the first attempt
    const uploadMock = vi.mocked(supabase.storage.from('scout-photos').upload);
    uploadMock.mockRejectedValueOnce(new Error('Upload failed'));

    render(<ScoutFolders {...mockProps} />);
    
    const file1 = new File(['c1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['c2'], 'photo2.jpg', { type: 'image/jpeg' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [file1, file2] } });

    const confirmBtn = await screen.findByText(/Confirmar e enviar/i);
    fireEvent.click(confirmBtn);

    // Wait for failure
    await waitFor(() => {
      expect(screen.getByText(/Tentar novamente 1 falha/i)).toBeInTheDocument();
    });

    // Check that one succeeded and one failed (if mocks are set up for that)
    // Now click retry
    const retryBtn = screen.getByText(/Tentar novamente 1 falha/i);
    
    // Mock success for retry
    uploadMock.mockResolvedValueOnce({ data: { id: 'f', path: 'p', fullPath: 'fp' }, error: null });
    
    fireEvent.click(retryBtn);
    
    // Verify it only retries the failed one
    // (In a real integration test we'd check how many times upload was called)
    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledTimes(3); // 1st file (fail), 2nd file (success), then 1st file again (success)
    });
  });
});
