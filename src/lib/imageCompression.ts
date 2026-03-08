import imageCompression from 'browser-image-compression';

export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: file.type as string,
  };

  try {
    const compressed = await imageCompression(file, options);
    return compressed;
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
    const thumbnail = await imageCompression(file, options);
    return thumbnail;
  } catch {
    return file;
  }
};
