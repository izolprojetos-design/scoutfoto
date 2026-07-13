import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AccessLogViewer from '@/components/AccessLogViewer';

// Mock DevicesSection para isolar teste
vi.mock('@/components/profile/DevicesSection', () => ({
  default: () => <div data-testid="devices-section" />,
}));

// Mock supabase client — se o gate falhar e o load rodar, ainda não quebra
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          gte: () => ({ lte: () => ({ range: () => Promise.resolve({ data: [], count: 0, error: null }) }) }),
          range: () => Promise.resolve({ data: [], count: 0, error: null }),
        }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

const hasRoleMock = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ hasRole: hasRoleMock }),
}));

describe('AccessLogViewer — gate de admin', () => {
  beforeEach(() => hasRoleMock.mockReset());

  it('bloqueia usuários não-admin com mensagem de acesso restrito', () => {
    hasRoleMock.mockReturnValue(false);
    render(<AccessLogViewer />);
    expect(screen.getByText(/Acesso restrito/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Apenas administradores podem visualizar o Log de Acessos/i)
    ).toBeInTheDocument();
    // Não renderiza a tabela nem a seção de dispositivos quando bloqueado
    expect(screen.queryByText(/Último acesso/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('devices-section')).not.toBeInTheDocument();
  });

  it('libera visualização para admin', () => {
    hasRoleMock.mockImplementation((r: string) => r === 'admin');
    render(<AccessLogViewer />);
    expect(screen.queryByText(/Acesso restrito/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Log de Acessos/i)).toBeInTheDocument();
    expect(screen.getByText(/Último acesso/i)).toBeInTheDocument();
  });
});
