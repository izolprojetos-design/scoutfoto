import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventDetail from '../pages/EventDetail';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import React from 'react';

// Mock Supabase - using inline factory to avoid hoisting issues
vi.mock('../integrations/supabase/client', () => {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    order: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: { id: 'event-123', name: 'Test Event', event_date: '2024-01-01' }, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'event-123' }, error: null })),
    then: vi.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb)),
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

describe('External Link Validation', () => {
  it('shows error when saving an invalid URL', async () => {
    render(
      <MemoryRouter initialEntries={['/events/event-123']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the page to load
    await waitFor(() => {
      expect(screen.getByText(/Test Event/i)).toBeInTheDocument();
    });

    // Open External Link Modal
    const addLinkBtn = await screen.findByText(/Link Externo/i);
    fireEvent.click(addLinkBtn);

    // Fill title
    const titleInput = screen.getByPlaceholderText(/Ex: Documentos do Acampamento/i);
    fireEvent.change(titleInput, { target: { value: 'Invalid Link Test' } });

    // Fill invalid URL
    const urlInput = screen.getByPlaceholderText(/https:\/\/drive.google.com\//i);
    fireEvent.change(urlInput, { target: { value: 'not-a-url' } });

    // Try to save
    const saveBtn = screen.getByRole('button', { name: /Adicionar Link/i });
    fireEvent.click(saveBtn);

    // Verify error toast
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('URL inválida'));
    });

    // Verify modal is still open
    expect(screen.getByRole('button', { name: /Adicionar Link/i })).toBeInTheDocument();
  });
});
