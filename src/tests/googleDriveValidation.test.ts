import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';

// Mocking toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mocking logAudit
const mockLogAudit = vi.fn();
vi.mock('@/lib/auditLog', () => ({
  logAudit: (...args: any[]) => mockLogAudit(...args),
}));

// Validation logic matching EventDetail.tsx exactly
const validateDriveLink = async (
  userId: string,
  eventId: string,
  normalizedUrl: string,
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
      await mockLogAudit(userId, 'access_denied', undefined, { 
        reason: 'missing_google_drive_links_permission',
        url: normalizedUrl,
        type: externalType,
        event_id: eventId
      });
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
        const reason = isGloballyDisabled ? 'global_drive_disabled' : 'type_blocked';
        
        toast.error(`Acesso Negado: O administrador desativou a inclusão de ${requestedType} do Google Drive.`);
        
        await mockLogAudit(userId, 'access_denied', undefined, { 
          reason,
          url: normalizedUrl,
          type: externalType,
          requested_label: requestedType,
          event_id: eventId
        });
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
  const userId = 'user-123';
  const eventId = 'event-456';
  const testUrl = 'https://drive.google.com/test';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows admins to bypass everything', async () => {
    const result = await validateDriveLink(userId, eventId, testUrl, true, true, false, 'image', configDisabled, { 
      canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
    });
    expect(result).toBe(true);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it('blocks users without basic drive permission and logs it', async () => {
    const result = await validateDriveLink(userId, eventId, testUrl, true, false, false, 'document', configOnlyDocs, { 
      canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
    });
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Você não tem permissão'));
    expect(mockLogAudit).toHaveBeenCalledWith(userId, 'access_denied', undefined, expect.objectContaining({
      reason: 'missing_google_drive_links_permission',
      event_id: eventId,
      type: 'document'
    }));
  });

  describe('Foto (Image)', () => {
    it('blocks and logs when globally disabled and no exception', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'image', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Acesso Negado: O administrador desativou a inclusão de Links de Foto'));
      expect(mockLogAudit).toHaveBeenCalledWith(userId, 'access_denied', undefined, expect.objectContaining({
        reason: 'global_drive_disabled',
        type: 'image',
        event_id: eventId
      }));
    });

    it('blocks when type specifically disabled and no exception', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'image', configOnlyDocs, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(false);
      expect(mockLogAudit).toHaveBeenCalledWith(userId, 'access_denied', undefined, expect.objectContaining({
        reason: 'type_blocked',
        type: 'image'
      }));
    });

    it('allows when globally enabled and type allowed', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'image', configOnlyImages, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it('allows when globally disabled BUT exception exists', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'image', configDisabled, { 
        canAddDriveImages: true, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });

  describe('Vídeo (Video)', () => {
    it('blocks and logs when globally disabled and no exception', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'video', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Acesso Negado: O administrador desativou a inclusão de Links de Vídeo'));
      expect(mockLogAudit).toHaveBeenCalledWith(userId, 'access_denied', undefined, expect.objectContaining({
        reason: 'global_drive_disabled',
        type: 'video'
      }));
    });

    it('allows when globally enabled and type allowed', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'video', configOnlyVideos, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
    });

    it('allows when globally disabled BUT exception exists', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'video', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: true, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
    });
  });

  describe('Documento (Document)', () => {
    it('blocks and logs when globally disabled and no exception', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'document', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Acesso Negado: O administrador desativou a inclusão de Links de Documento'));
      expect(mockLogAudit).toHaveBeenCalledWith(userId, 'access_denied', undefined, expect.objectContaining({
        reason: 'global_drive_disabled',
        type: 'document'
      }));
    });

    it('allows when globally enabled and type allowed', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'document', configOnlyDocs, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: false 
      });
      expect(result).toBe(true);
    });

    it('allows when globally disabled BUT exception exists', async () => {
      const result = await validateDriveLink(userId, eventId, testUrl, true, false, true, 'document', configDisabled, { 
        canAddDriveImages: false, canAddDriveVideos: false, canAddDriveDocuments: true 
      });
      expect(result).toBe(true);
    });
  });
});
