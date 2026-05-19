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
    delete: vi.fn(() => Promise.resolve({ error: null })),
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
      // Return images
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

  it('completes the add, edit, and delete lifecycle for external links', async () => {
    render(
      <MemoryRouter initialEntries={['/events/event-123']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // 1. ADD
    await screen.findByText(/Test Event/i);
    const linkBtn = await screen.findByRole('button', { name: /Link Externo/i });
    fireEvent.click(linkBtn);
    
    const videoOption = await screen.findByText(/Link de Vídeo/i);
    fireEvent.click(videoOption);

    fireEvent.change(screen.getByLabelText(/Título \/ Nome do Arquivo/i), { target: { value: 'New Video Link' } });
    fireEvent.change(screen.getByLabelText(/URL do Google Drive/i), { target: { value: 'drive.google.com/video' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Link/i }));
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Link externo adicionado'));
    });

    // 2. EDIT
    // Click existing image to open viewer
    const existingImg = await screen.findByText(/Existing Photo Link/i);
    fireEvent.click(existingImg);

    // Open edit from viewer
    const editBtn = await screen.findByRole('button', { name: /Editar Link/i });
    fireEvent.click(editBtn);

    // Change type in modal
    const typeSelect = screen.getByLabelText(/Tipo de Mídia/i);
    fireEvent.click(typeSelect);
    
    // In Shadcn UI/Radix, selecting options in tests often requires specific handling, 
    // but here we verify the modal fields are pre-filled correctly
    expect(screen.getByLabelText(/Título \/ Nome do Arquivo/i)).toHaveValue('Existing Photo Link');
    
    fireEvent.change(screen.getByLabelText(/Título \/ Nome do Arquivo/i), { target: { value: 'Updated Link Name' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Link atualizado'));
    });

    // 3. DELETE
    // Open viewer again (it might have closed after save)
    const updatedImg = await screen.findByText(/Updated Link Name/i);
    fireEvent.click(updatedImg);

    const deleteBtn = await screen.findByRole('button', { name: /Excluir/i });
    fireEvent.click(deleteBtn);

    // Confirm in AlertDialog
    const confirmBtn = await screen.findByRole('button', { name: /^Excluir$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Link excluído'));
    });
  });
});
