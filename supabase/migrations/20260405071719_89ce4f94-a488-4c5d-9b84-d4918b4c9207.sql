
-- Rename "Ver fotos" to "Visualizar Fotos"
UPDATE permissions SET name = 'Visualizar Fotos' WHERE key = 'view_photos';

-- Add new permissions
INSERT INTO permissions (key, name, category, sort_order) VALUES
  ('edit_photos', 'Editar Fotos', 'Fotos', 0),
  ('delete_photos', 'Excluir Foto', 'Fotos', 0);

-- Reorder alphabetically: Baixar fotos(1), Editar Fotos(2), Enviar fotos(3), Excluir Foto(4), Visualizar Fotos(5)
UPDATE permissions SET sort_order = 1 WHERE key = 'download_photos';
UPDATE permissions SET sort_order = 2 WHERE key = 'edit_photos';
UPDATE permissions SET sort_order = 3 WHERE key = 'upload_photos';
UPDATE permissions SET sort_order = 4 WHERE key = 'delete_photos';
UPDATE permissions SET sort_order = 5 WHERE key = 'view_photos';
