import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScoutCalendar from '../ScoutCalendar';

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const LONG_TEXT = 'A'.repeat(400);

let eventsData: any[] = [];

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ roles: ['admin'], user: { id: 'u1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: async () => ({
        data: table === 'events' ? eventsData : [],
        error: null,
      }),
    }),
  },
}));

const openDay = async () => {
  const cell = await screen.findByText(String(today.getDate()));
  fireEvent.click(cell.parentElement!);
};

describe('Seção Informativo do card de evento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não aparece quando o evento não tem descrição', async () => {
    eventsData = [{ id: '1', name: 'Reunião', event_date: iso, description: null }];
    render(<ScoutCalendar />);
    await openDay();
    expect((await screen.findAllByText('Reunião')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('informativo-section')).toBeNull();
  });
38: 
39:   it('não aparece quando a descrição é uma string vazia', async () => {
40:     eventsData = [{ id: '1-empty', name: 'Reunião Vazia', event_date: iso, description: '' }];
41:     render(<ScoutCalendar />);
42:     await openDay();
43:     expect(screen.queryByTestId('informativo-section')).toBeNull();
44:   });
45: 
46:   it('não aparece quando a descrição contém apenas espaços', async () => {
47:     eventsData = [{ id: '1-spaces', name: 'Reunião Espaços', event_date: iso, description: '   ' }];
48:     render(<ScoutCalendar />);
49:     await openDay();
50:     expect(screen.queryByTestId('informativo-section')).toBeNull();
51:   });

  it('aparece quando o evento tem descrição', async () => {
    eventsData = [{ id: '2', name: 'Acampamento', event_date: iso, description: 'Levar barraca' }];
    render(<ScoutCalendar />);
    await openDay();
    expect(await screen.findByTestId('informativo-section')).toBeTruthy();
    expect(screen.getByText('Informativo')).toBeTruthy();
    expect(screen.getByText('Levar barraca')).toBeTruthy();
  });

  it('colapsa descrições longas e permite expandir', async () => {
    eventsData = [{ id: '3', name: 'Jamboree', event_date: iso, description: LONG_TEXT }];
    render(<ScoutCalendar />);
    await openDay();
    const toggle = await screen.findByRole('button', { name: /ver mais/i });
    expect(screen.queryByText(LONG_TEXT)).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText(LONG_TEXT)).toBeTruthy();
    expect(screen.getByRole('button', { name: /ver menos/i })).toBeTruthy();
  });
});
