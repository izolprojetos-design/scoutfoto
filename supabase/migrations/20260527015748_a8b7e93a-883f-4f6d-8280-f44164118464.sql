-- Política para permitir upload de avatar pelo próprio usuário
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scout-photos' AND 
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = (auth.uid())::text
);

-- Política para permitir atualização de avatar pelo próprio usuário
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'scout-photos' AND 
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = (auth.uid())::text
);

-- Política para permitir exclusão de avatar pelo próprio usuário
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'scout-photos' AND 
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = (auth.uid())::text
);

-- Política para permitir visualização de avatares (já que o bucket não é público)
-- Se não houver uma política de SELECT que cubra isso, os usuários não verão os avatares.
-- Vou adicionar uma específica para a pasta avatars caso a "Role-based view scout photos" não seja suficiente ou restritiva demais.
CREATE POLICY "Users can view all avatares"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scout-photos' AND 
  (storage.foldername(name))[1] = 'avatars'
);