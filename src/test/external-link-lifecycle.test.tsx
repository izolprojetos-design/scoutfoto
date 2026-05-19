import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventDetail from '../pages/EventDetail';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import React from 'react';

// Mock Supabase
const mockImages = [
  { 
    id: 'link-1', 
    media_type: 'image', 
    filename: 'Existing Photo Link', 
    created_at: new Date().toISOString(), 
    views: 0, 
    downloads: 0, 
    external_url: 'https://drive.google.com/photo',
    branch_id: 'branch-1',
    user_id: 'user-123'
  }
];

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
      return Promise.resolve({ data: mockImages, error: null }).then(cb);
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

// Mock audit log
vi.mock('@/lib/auditLog', () => ({
  logAudit: vi.fn().mockResolvedValue(null),
}));

describe('External Link Lifecycle E2E Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes the add lifecycle simulation', async () => {
    render(
      <MemoryRouter initialEntries={['/events/event-123']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/Test Event/i);
    const linkDropdownBtn = await screen.findByTestId('link-externo-dropdown');
    expect(linkDropdownBtn).toBeInTheDocument();
  });

  it('completes the edit and delete lifecycle for external links', async () => {
    render(
      <MemoryRouter initialEntries={['/events/event-123']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Use data-testid to click the item
    const mediaItem = await screen.findByTestId('media-item-link-1');
    fireEvent.click(mediaItem);

    // Open edit from viewer
    const editBtn = await screen.findByTestId('edit-external-link');
    fireEvent.click(editBtn);

    // Verify modal fields
    const titleInput = screen.getByLabelText(/Título \/ Nome do Arquivo/i);
    expect(titleInput).toHaveValue('Existing Photo Link');
    
    fireEvent.change(titleInput, { target: { value: 'Updated Link Name' } });
    fireEvent.click(screen.getByTestId('save-external-link'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Link atualizado'));
    });

    // DELETE
    fireEvent.click(mediaItem);
    const deleteBtn = await screen.findByTestId('delete-media-button');
    fireEvent.click(deleteBtn);

    const confirmBtn = await screen.findByTestId('confirm-delete-button');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Link excluído'));
    });
  });
});
