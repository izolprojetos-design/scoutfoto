import imageCompression from 'browser-image-compression';

export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: file.type as string,
    initialQuality: 0.8,
  };

  try {
    return await imageCompression(file, options);
  } catch {
    console.warn('Compression failed, using original file');
    return file;
  }
};

export const createThumbnail = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 400,
    useWebWorker: true,
    fileType: 'image/webp' as string,
  };

  try {
    return await imageCompression(file, options);
  } catch {
    return file;
  }
};

export const compressScoutPhoto = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/webp' as string,
    initialQuality: 0.8,
  };

  try {
    return await imageCompression(file, options);
  } catch {
    console.warn('Scout photo compression failed, using original');
    return file;
  }
};

export const compressAvatar = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 512,
    useWebWorker: true,
    fileType: 'image/webp' as string,
    initialQuality: 0.8,
  };

  try {
    return await imageCompression(file, options);
  } catch {
    console.warn('Avatar compression failed, using original');
    return file;
  }
};
