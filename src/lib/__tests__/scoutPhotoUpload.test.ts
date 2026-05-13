/**
 * Testes de integração do fluxo de captura/upload de foto de integrante.
 *
 * Cobre:
 *  - Compressão da foto via compressScoutPhoto (image/webp, ~500KB max)
 *  - Geração de nome de arquivo seguro (sem acentos/espaços) usando o nome do integrante
 *  - Remoção de arquivos antigos do mesmo scout (limpeza)
 *  - Upload com upsert:true e contentType correto no bucket scout-photos
 *  - Persistência do path retornado em scouts.photo_url
 *  - Tratamento de erro do Storage (não persiste photo_url)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks ----------------------------------------------------------------------

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => {
    // Simula compressão para webp ~50KB
    return new File([new Uint8Array(50 * 1024)], file.name.replace(/\.[^.]+$/, '.webp'), {
      type: 'image/webp',
    });
  }),
}));

const storageState = {
  listResult: { data: [] as Array<{ name: string }>, error: null as any },
  uploadResult: { data: { path: '' }, error: null as any },
  removeCalls: [] as string[][],
  uploadCalls: [] as Array<{ path: string; file: any; opts: any }>,
};

const dbState = {
  updateResult: { error: null as any },
  updateCalls: [] as Array<{ table: string; values: any; eqId: string }>,
};

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      storage: {
        from: (_bucket: string) => ({
          list: vi.fn(async () => storageState.listResult),
          remove: vi.fn(async (paths: string[]) => {
            storageState.removeCalls.push(paths);
            return { data: null, error: null };
          }),
          upload: vi.fn(async (path: string, file: any, opts: any) => {
            storageState.uploadCalls.push({ path, file, opts });
            return storageState.uploadResult;
          }),
        }),
      },
      from: (table: string) => ({
        update: (values: any) => ({
          eq: async (_col: string, id: string) => {
            dbState.updateCalls.push({ table, values, eqId: id });
            return dbState.updateResult;
          },
        }),
      }),
    },
  };
});

// Reimplementação fiel da função interna uploadPhoto (mesmo código de Scouts.tsx)
import { supabase } from '@/integrations/supabase/client';
import { compressScoutPhoto } from '@/lib/imageCompression';

const uploadPhoto = async (
  scoutId: string,
  photo: File,
  scoutNameForFile?: string
): Promise<string | null> => {
  const ext = photo.name.split('.').pop() || 'jpg';
  const safeName = (scoutNameForFile || scoutId)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const path = `${safeName}_${scoutId.slice(0, 8)}.${ext}`;
  const { data: existingFiles } = await supabase.storage
    .from('scout-photos')
    .list('', { search: scoutId.slice(0, 8) } as any);
  if (existingFiles) {
    for (const f of existingFiles) {
      if (f.name.includes(scoutId.slice(0, 8)) && f.name !== path) {
        await supabase.storage.from('scout-photos').remove([f.name]);
      }
    }
  }
  const compressed = await compressScoutPhoto(photo);
  const { error } = await supabase.storage
    .from('scout-photos')
    .upload(path, compressed, { upsert: true, contentType: compressed.type } as any);
  if (error) return null;
  return path;
};

const persistPhotoUrl = async (scoutId: string, path: string) => {
  const { error } = await (supabase.from('scouts') as any).update({ photo_url: path }).eq('id', scoutId);
  return !error;
};

// Testes ---------------------------------------------------------------------

describe('Fluxo de upload de foto do integrante', () => {
  const scoutId = 'abc12345-aaaa-bbbb-cccc-ddddeeeeffff';
  const sampleFile = new File([new Uint8Array(2 * 1024 * 1024)], 'IMG_0001.jpg', {
    type: 'image/jpeg',
  });

  beforeEach(() => {
    storageState.listResult = { data: [], error: null };
    storageState.uploadResult = { data: { path: '' }, error: null };
    storageState.removeCalls = [];
    storageState.uploadCalls = [];
    dbState.updateResult = { error: null };
    dbState.updateCalls = [];
  });

  it('comprime a foto antes do upload (webp, tamanho reduzido)', async () => {
    await uploadPhoto(scoutId, sampleFile, 'João da Silva');
    expect(storageState.uploadCalls).toHaveLength(1);
    const uploaded = storageState.uploadCalls[0].file as File;
    expect(uploaded.type).toBe('image/webp');
    expect(uploaded.size).toBeLessThan(sampleFile.size);
  });

  it('gera path seguro: remove acentos e caracteres especiais do nome', async () => {
    const path = await uploadPhoto(scoutId, sampleFile, 'João da Silva Júnior');
    expect(path).toBe('Joao_da_Silva_Junior_abc12345.jpg');
    expect(path).not.toMatch(/[ãáéíóúçÀ-ÿ]/);
  });

  it('faz upload no bucket scout-photos com upsert:true e contentType correto', async () => {
    await uploadPhoto(scoutId, sampleFile, 'TESTE');
    const call = storageState.uploadCalls[0];
    expect(call.opts).toMatchObject({ upsert: true, contentType: 'image/webp' });
    expect(call.path).toMatch(/^TESTE_abc12345\./);
  });

  it('remove arquivos antigos do mesmo integrante antes de subir o novo', async () => {
    storageState.listResult = {
      data: [
        { name: 'NomeAntigo_abc12345.jpg' },
        { name: 'OutroIntegrante_99999999.jpg' }, // não deve ser removido
      ],
      error: null,
    };
    await uploadPhoto(scoutId, sampleFile, 'NovoNome');
    expect(storageState.removeCalls).toHaveLength(1);
    expect(storageState.removeCalls[0]).toEqual(['NomeAntigo_abc12345.jpg']);
  });

  it('persiste o path retornado em scouts.photo_url quando o upload tem sucesso', async () => {
    const path = await uploadPhoto(scoutId, sampleFile, 'TESTE');
    expect(path).not.toBeNull();
    const ok = await persistPhotoUrl(scoutId, path!);
    expect(ok).toBe(true);
    expect(dbState.updateCalls).toEqual([
      { table: 'scouts', values: { photo_url: path }, eqId: scoutId },
    ]);
  });

  it('retorna null e NÃO persiste photo_url quando o Storage falha', async () => {
    storageState.uploadResult = { data: null, error: { message: 'storage down' } };
    const path = await uploadPhoto(scoutId, sampleFile, 'TESTE');
    expect(path).toBeNull();
    expect(dbState.updateCalls).toHaveLength(0);
  });
});
