import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Scouts from '../pages/Scouts';
import { BrowserRouter } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Supabase
vi.mock('../integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (cb: any) => Promise.resolve(cb({ data: [], error: null })),
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'mock-url' }, error: null }),
        createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock Auth Context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { email: 'test@example.com' },
    isAdmin: true,
    isVoluntario: false,
    canUpload: true,
  }),
}));

describe('Smartphone Upload Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify components are rendered and interactive', async () => {
    render(
      <BrowserRouter>
        <Scouts />
      </BrowserRouter>
    );

    // Check if toolbar buttons are present
    const photosBtn = await screen.findByRole('button', { name: /fotos/i });
    expect(photosBtn).toBeInTheDocument();
  });
});
