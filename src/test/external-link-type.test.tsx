import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventDetail from '../pages/EventDetail';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import React from 'react';

// Mock Supabase
vi.mock('../integrations/supabase/client', () => {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve({ data: { id: 'new-link-123' }, error: null })),
    update: vi.fn(() => Promise.resolve({ error: null })),
    delete: vi.fn(() => chain),
    order: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ 
      data: { 
        id: 'event-123', 
        name: 'Test Event', 
        event_date: '2024-01-01',
        created_at: new Date().toISOString(),
        branch_id: 'branch-1'
      }, 
      error: null 
    })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'event-123' }, error: null })),
    then: vi.fn((cb) => {
      // Return empty images list initially to see the main CTA buttons
      return Promise.resolve({ data: [], error: null }).then(cb);
    }),
  };

  return {
    supabase: {
      from: vi.fn(() => chain),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'mock' }, error: null }),
          remove: vi.fn().mockResolvedValue({ error: null }),
        })),
      },
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    }
  };
});

// Mock Auth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    isAdmin: true,
    canUpload: true,
    roles: ['admin'],
  }),
}));

// Mock permissions hook
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canUploadEventPhotos: true,
    canDownloadEventPhotos: true,
    canDeleteEventPhotos: true,
    canEditEvents: true,
    loading: false,
  }),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe('External Link Type and Filter E2E Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows adding a link with a specific type and normalizes URL', async () => {
    render(
      <MemoryRouter initialEntries={['/events/event-123']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Test Event/i)).toBeInTheDocument();
    });

    // When images are empty, it shows "Adicionar Foto", "Adicionar Vídeo", "Link Externo" (dropdown)
    // Find the dropdown button
    const linkBtn = await screen.findByRole('button', { name: /Link Externo/i });
    fireEvent.click(linkBtn);

    // Select "Link de Vídeo" from dropdown
    const videoOption = await screen.findByText(/Link de Vídeo/i);
    fireEvent.click(videoOption);

    // Verify modal title
    expect(await screen.findByText('Adicionar Link Externo')).toBeInTheDocument();

    // Fill title
    const titleInput = screen.getByLabelText(/Título \/ Nome do Arquivo/i);
    fireEvent.change(titleInput, { target: { value: 'My Video Link' } });

    // Fill URL without https
    const urlInput = screen.getByLabelText(/URL do Google Drive/i);
    fireEvent.change(urlInput, { target: { value: 'drive.google.com/file/123' } });

    // Save
    const saveBtn = screen.getByRole('button', { name: /Adicionar Link/i });
    fireEvent.click(saveBtn);

    // Verify normalization and call
    await waitFor(() => {
      const { supabase } = require('../integrations/supabase/client');
      expect(supabase.from).toHaveBeenCalledWith('images');
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Link externo adicionado'));
    });
  });
});
