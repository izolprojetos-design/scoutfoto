import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';

// Mocking toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Validation logic matching EventDetail.tsx exactly
const validateDriveLink = (
  isGoogleDrive: boolean,
  isAdmin: boolean,
  canManageGoogleDrive: boolean,
  externalType: 'image' | 'video' | 'document',
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

describe('Google Drive Link Validation (Integration Logic)', () => {
  const configDisabled = { enabled: false, allowed_types: [] };
  const configOnlyDocs = { enabled: true, allowed_types: ['document'] };
  const configOnlyImages = { enabled: true, allowed_types: ['image'] };
  const configOnlyVideos = { enabled: true, allowed_types: ['video'] };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  describe('Foto (Image)', () => {
    it('blocks when globally disabled and no exception', () => {
      const result = validateDriveLink(true, false, true, 'image', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Acesso Negado: O administrador desativou a inclusão de Links de Foto'));
    });

    it('blocks when type specifically disabled and no exception', () => {
      const result = validateDriveLink(true, false, true, 'image', configOnlyDocs, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(false);
    });

    it('allows when globally enabled and type allowed', () => {
      const result = validateDriveLink(true, false, true, 'image', configOnlyImages, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
    });

    it('allows when globally disabled BUT exception exists', () => {
      const result = validateDriveLink(true, false, true, 'image', configDisabled, { 
        canAddDriveImages: true, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
    });
  });

  describe('Vídeo (Video)', () => {
    it('blocks when globally disabled and no exception', () => {
      const result = validateDriveLink(true, false, true, 'video', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Acesso Negado: O administrador desativou a inclusão de Links de Vídeo'));
    });

    it('allows when globally enabled and type allowed', () => {
      const result = validateDriveLink(true, false, true, 'video', configOnlyVideos, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
    });

    it('allows when globally disabled BUT exception exists', () => {
      const result = validateDriveLink(true, false, true, 'video', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: true, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
    });
  });

  describe('Documento (Document)', () => {
    it('blocks when globally disabled and no exception', () => {
      const result = validateDriveLink(true, false, true, 'document', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Acesso Negado: O administrador desativou a inclusão de Links de Documento'));
    });

    it('allows when globally enabled and type allowed', () => {
      const result = validateDriveLink(true, false, true, 'document', configOnlyDocs, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
    });

    it('allows when globally disabled BUT exception exists', () => {
      const result = validateDriveLink(true, false, true, 'document', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: true 
      });
      expect(result).toBe(true);
    });
  });
});
