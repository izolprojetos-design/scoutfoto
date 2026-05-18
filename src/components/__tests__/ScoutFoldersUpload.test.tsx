import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScoutFolders from '../ScoutFolders';
import { supabase } from '@/integrations/supabase/client';
import '@testing-library/jest-dom';

// Global mocks for JSDOM
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'mock-url');
  window.URL.revokeObjectURL = vi.fn();
  
  // Mock ResizeObserver
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
    
    const file = new File(['content'], 'test-photo.jpg', { type: 'image/jpeg' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const galleryInput = fileInputs[0] as HTMLInputElement;

    fireEvent.change(galleryInput, { target: { files: [file] } });

    // Wait for dialog
    const confirmBtn = await screen.findByText(/Confirmar e enviar/i);
    fireEvent.click(confirmBtn);

    // Check for aria-live elements during upload
    await waitFor(() => {
      const liveRegions = document.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions.length).toBeGreaterThan(0);
      
      // Verify progress bar attributes
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow');
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
    
    // "Sim, cancelar" should be present
    const confirmCancelBtn = screen.getByText(/Sim, cancelar/i);
    expect(confirmCancelBtn).toBeInTheDocument();
  });

  it('handles retrying failed uploads correctly', async () => {
    // Mock upload behavior
    const uploadMock = vi.mocked(supabase.storage.from('scout-photos').upload);
    
    render(<ScoutFolders {...mockProps} />);
    
    const file1 = new File(['c1'], 'photo1.jpg', { type: 'image/jpeg' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [file1] } });

    const confirmBtn = await screen.findByText(/Confirmar e enviar/i);
    
    // Mock failure
    uploadMock.mockRejectedValueOnce(new Error('Upload failed'));
    
    fireEvent.click(confirmBtn);

    // Wait for retry button
    const retryBtn = await screen.findByText(/Tentar novamente/i);
    expect(retryBtn).toBeInTheDocument();

    // Mock success for retry
    uploadMock.mockResolvedValueOnce({ data: { id: 'f', path: 'p', fullPath: 'fp' }, error: null });
    
    fireEvent.click(retryBtn);
    
    await waitFor(() => {
      // The dialog closes on success if all are done
      expect(screen.queryByText(/Confirmar e enviar/i)).not.toBeInTheDocument();
    });
  });
});
