import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventDetail from '../pages/EventDetail';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import React from 'react';

// Mock Supabase
vi.mock('../integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'event-123', name: 'Test Event', event_date: '2024-01-01' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'event-123' }, error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'mock' }, error: null }),
      })),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

// Mock Auth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    isAdmin: true,
    canUpload: true,
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

// Mock framer-motion to avoid issues in test
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

    // Wait for the page to load (look for event name)
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

    // Select a branch if needed (though we mock events)
    // Ramo is usually populated by branches state
    
    // Try to save
    const saveBtn = screen.getByRole('button', { name: /Adicionar Link/i });
    fireEvent.click(saveBtn);

    // Verify error toast
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('URL inválida'));
    });

    // Verify modal is still open (save button still visible)
    expect(screen.getByRole('button', { name: /Adicionar Link/i })).toBeInTheDocument();
  });
});
