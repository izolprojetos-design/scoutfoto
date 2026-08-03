-- Update existing permission category
UPDATE permissions SET category = 'Google Drive' WHERE key = 'google_drive_links';

-- Insert granular permissions
INSERT INTO permissions (key, name, category, sort_order) VALUES 
('google_drive_images', 'Exceção: Permitir Links de Fotos do Drive', 'Google Drive', 11),
('google_drive_videos', 'Exceção: Permitir Links de Vídeos do Drive', 'Google Drive', 12),
('google_drive_documents', 'Exceção: Permitir Links de Documentos do Drive', 'Google Drive', 13)
ON CONFLICT (key) DO NOTHING;
