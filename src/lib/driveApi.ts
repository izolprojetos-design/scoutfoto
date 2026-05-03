import { supabase } from '@/integrations/supabase/client';

export interface UploadProgress {
  total: number;
  current: number;
  fileName: string;
  progressPercentage: number;
}

export interface UploadDriveParams {
  ramo: string;
  nome: string;
  data: string;
  files: File[];
  onProgress?: (progress: UploadProgress) => void;
}

export const uploadToGoogleDrive = async ({ ramo, nome, data, files, onProgress }: UploadDriveParams) => {
  let successCount = 0;
  let lastFolderId = null;
  let lastFolderLink = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (onProgress) {
      onProgress({
        total: files.length,
        current: i + 1,
        fileName: file.name,
        progressPercentage: Math.round(((i) / files.length) * 100)
      });
    }

    const formData = new FormData();
    formData.append('ramo', ramo);
    formData.append('nome', nome);
    formData.append('data', data);
    formData.append('file', file);

    const { data: responseData, error } = await supabase.functions.invoke('drive-upload', {
      body: formData,
    });

    if (error) {
      console.error(`Erro ao fazer upload do arquivo ${file.name}:`, error);
      throw new Error(`Falha no upload do arquivo ${file.name}: ${error.message}`);
    }

    if (responseData && responseData.success) {
      successCount++;
      lastFolderId = responseData.folderId;
      lastFolderLink = responseData.folderLink;
    } else {
      throw new Error(`Falha desconhecida ao fazer upload de ${file.name}`);
    }
  }

  // Se finalizou com sucesso, registra no banco
  if (successCount > 0 && lastFolderId) {
    if (onProgress) {
      onProgress({
        total: files.length,
        current: files.length,
        fileName: 'Finalizando...',
        progressPercentage: 100
      });
    }

    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { error: dbError } = await supabase
      .from('drive_uploads')
      .insert({
        branch: ramo,
        scout_name: nome,
        photo_date: data,
        drive_folder_id: lastFolderId,
        drive_folder_url: lastFolderLink,
        file_name: `${successCount} arquivo(s)`,
        status: 'success',
        user_id: userId!,
      });

    if (dbError) {
      console.warn("Erro ao registrar o log do upload no banco de dados:", dbError);
    }
  }

  return {
    success: true,
    totalUploaded: successCount,
    folderLink: lastFolderLink
  };
};
