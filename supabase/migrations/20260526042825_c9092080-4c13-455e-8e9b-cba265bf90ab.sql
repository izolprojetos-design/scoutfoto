-- Ensure permissions exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'view_photos') THEN
        INSERT INTO permissions (key, name, category) VALUES ('view_photos', 'Ver Fotos', 'Fotos');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'view_scouts') THEN
        INSERT INTO permissions (key, name, category) VALUES ('view_scouts', 'Ver Integrantes', 'Integrantes');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'view_events') THEN
        INSERT INTO permissions (key, name, category) VALUES ('view_events', 'Ver Eventos', 'Eventos');
    END IF;
END $$;

-- Default permissions for 'parent'
INSERT INTO role_permissions (role, permission_id)
SELECT 'parent', id FROM permissions WHERE key IN ('view_photos', 'view_scouts', 'view_events')
ON CONFLICT DO NOTHING;

-- Default permissions for 'voluntario'
INSERT INTO role_permissions (role, permission_id)
SELECT 'voluntario', id FROM permissions WHERE key IN ('view_photos', 'view_scouts', 'view_events', 'upload_photos')
ON CONFLICT DO NOTHING;

-- Default permissions for 'chefe'
INSERT INTO role_permissions (role, permission_id)
SELECT 'chefe', id FROM permissions WHERE key IN ('view_photos', 'view_scouts', 'view_events', 'upload_photos', 'manage_events')
ON CONFLICT DO NOTHING;
