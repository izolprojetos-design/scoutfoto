import { describe, it, expect, vi } from 'vitest';
import { toast } from 'sonner';

// Mocking toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Validation logic extracted for testing
const validateDriveLink = (
  isGoogleDrive: boolean,
  isAdmin: boolean,
  canManageGoogleDrive: boolean,
  externalType: string,
  config: any,
  exceptions: { canAddDriveImages: boolean; canAddDriveVideos: boolean; canAddDriveDocuments: boolean }
) => {
  if (isGoogleDrive && !isAdmin) {
    if (!canManageGoogleDrive) {
      toast.error('Você não tem permissão para adicionar links do Google Drive. Entre em contato com um administrador.');
      return false;
    }

    if (config) {
      const allowedTypes = config.allowed_types || [];
      const isGloballyDisabled = config.enabled === false;
      const isTypeGloballyAllowed = allowedTypes.includes(externalType);
      
      const hasException = (externalType === 'image' && exceptions.canAddDriveImages) ||
                          (externalType === 'video' && exceptions.canAddDriveVideos) ||
                          (externalType === 'document' && exceptions.canAddDriveDocuments);

      if (!hasException && (isGloballyDisabled || !isTypeGloballyAllowed)) {
        const typeLabels: Record<string, string> = {
          image: 'Links de Foto',
          video: 'Links de Vídeo',
          document: 'Links de Documento'
        };
        const requestedType = typeLabels[externalType] || 'Este tipo de link';
        toast.error(`Acesso Negado: O administrador desativou a inclusão de ${requestedType} do Google Drive.`);
        return false;
      }
    }
  }
  return true;
};

describe('Google Drive Link Validation', () => {
  const configDisabled = { enabled: false, allowed_types: [] };
  const configOnlyDocs = { enabled: true, allowed_types: ['document'] };
  
  it('allows admins to bypass everything', () => {
    const result = validateDriveLink(true, true, false, 'image', configDisabled, { 
      canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
    });
    expect(result).toBe(true);
  });

  it('blocks users without basic drive permission', () => {
    const result = validateDriveLink(true, false, false, 'document', configOnlyDocs, { 
      canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
    });
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Você não tem permissão'));
  });

  it('blocks disallowed types when no exception exists', () => {
    const result = validateDriveLink(true, false, true, 'image', configOnlyDocs, { 
      canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
    });
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Acesso Negado: O administrador desativou a inclusão de Links de Foto'));
  });

  it('allows disallowed types when user has specific exception', () => {
    const result = validateDriveLink(true, false, true, 'image', configOnlyDocs, { 
      canAddDriveImages: true, canAddDriveVideos: false, canAddDriveDocuments: false 
    });
    expect(result).toBe(true);
  });

  it('allows disallowed types when global is disabled but user has exception', () => {
    const result = validateDriveLink(true, false, true, 'video', configDisabled, { 
      canAddDriveImages: false, canAddDriveVideos: true, canAddDriveDocuments: false 
    });
    expect(result).toBe(true);
  });
});
