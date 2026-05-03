import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, X, Cloud, CheckCircle2, Image as ImageIcon, Loader2, Link2, AlertCircle, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { uploadToGoogleDrive, UploadProgress } from '@/lib/driveApi';
import { ALL_CATEGORIES } from '@/lib/scoutUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const GOOGLE_CLIENT_ID = "1049582988328-bfro4hn5v8grq8dj57q54b1la3s7jshc.apps.googleusercontent.com";

const BancoImagens = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [ramo, setRamo] = useState<string>('');
  const [nome, setNome] = useState<string>('');
  const [dataEvento, setDataEvento] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [successData, setSuccessData] = useState<{ total: number; folderLink: string } | null>(null);

  const [connection, setConnection] = useState<{ google_email: string } | null>(null);
  const [loadingConn, setLoadingConn] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Banco de Imagens — Google Drive | ScoutFoto';
    loadConnection();
  }, [user]);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code && user && !isAuthenticating) {
      handleOAuthCallback(code);
    }
  }, [searchParams, user]);

  const loadConnection = async () => {
    if (!user) return;
    setLoadingConn(true);
    const { data, error } = await supabase
      .from('user_google_tokens' as any)
      .select('google_email')
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (data) {
      setConnection(data as any);
    } else {
      setConnection(null);
    }
    setLoadingConn(false);
  };

  const handleOAuthCallback = async (code: string) => {
    setIsAuthenticating(true);
    toast.loading('Autenticando com o Google...', { id: 'oauth-toast' });
    
    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUri = isLocalhost 
        ? 'http://localhost:5173/banco-imagens' 
        : 'https://scoutfoto.app/banco-imagens';

      const { data, error } = await supabase.functions.invoke('drive-auth', {
        body: { code, redirectUri }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success('Google Drive conectado com sucesso!', { id: 'oauth-toast' });
      
      // Limpar a URL removendo o código
      searchParams.delete('code');
      searchParams.delete('scope');
      setSearchParams(searchParams, { replace: true });
      
      await loadConnection();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao conectar ao Google Drive.', { id: 'oauth-toast' });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleConnectDrive = () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseRedirectUri = isLocalhost 
      ? 'http://localhost:5173/banco-imagens' 
      : 'https://scoutfoto.app/banco-imagens';
      
    const redirectUri = encodeURIComponent(baseRedirectUri);
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent`;
    
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_google_tokens' as any)
      .delete()
      .eq('user_id', user.id);
      
    if (error) {
      toast.error('Erro ao desconectar.');
      return;
    }
    
    toast.success('Conta Google desconectada.');
    setConnection(null);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = (newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length !== newFiles.length) {
      toast.warning('Alguns arquivos foram ignorados por não serem imagens válidas.');
    }

    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const resetForm = () => {
    setRamo('');
    setNome('');
    setDataEvento('');
    setFiles([]);
    setSuccessData(null);
    setUploadProgress(null);
  };

  const handleUpload = async () => {
    if (!connection) return toast.error('Conecte o Google Drive primeiro.');
    if (!ramo) return toast.error('Selecione um ramo para organizar as fotos.');
    if (!nome.trim()) return toast.error('Informe o nome do evento/atividade.');
    if (!dataEvento) return toast.error('Informe a data do evento.');
    if (files.length === 0) return toast.error('Selecione pelo menos uma foto para enviar.');

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length, fileName: 'Preparando...', progressPercentage: 0 });
    
    try {
      const result = await uploadToGoogleDrive({
        ramo,
        nome: nome.trim(),
        data: dataEvento,
        files,
        onProgress: setUploadProgress
      });

      if (result.success) {
        setSuccessData({
          total: result.totalUploaded,
          folderLink: result.folderLink || ''
        });
        toast.success(`${result.totalUploaded} fotos enviadas com sucesso!`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer upload das fotos.');
    } finally {
      setIsUploading(false);
    }
  };

  if (successData) {
    return (
      <div className="container max-w-2xl mx-auto py-8">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <CheckCircle2 className="h-20 w-20 text-green-500" />
            </motion.div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-400">Upload Concluído!</h2>
              <p className="text-muted-foreground">
                Foram enviadas {successData.total} fotos com sucesso para o seu Google Drive.
              </p>
            </div>

            <div className="flex gap-4 mt-4 w-full sm:w-auto">
              {successData.folderLink && (
                <Button asChild className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <a href={successData.folderLink} target="_blank" rel="noreferrer">
                    <Cloud className="h-4 w-4" />
                    Abrir Pasta no Google Drive
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                Fazer Novo Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Cloud className="h-8 w-8 text-primary" />
          Banco de Imagens
        </h1>
        <p className="text-muted-foreground">
          Envie e organize fotos das atividades escoteiras automaticamente no seu Google Drive.
        </p>
      </div>

      {/* Conexão Google */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conexão com o Google Drive</CardTitle>
          <CardDescription>
            Conecte sua conta para organizar as fotos diretamente no seu Drive pessoal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConn || isAuthenticating ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {isAuthenticating ? 'Autenticando...' : 'Verificando conexão…'}
            </div>
          ) : connection ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                Conectado como <strong>{connection.google_email || 'conta Google'}</strong>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isUploading}>
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Nenhuma conta conectada. Conecte-se para começar a enviar fotos.</span>
              </div>
              <Button onClick={handleConnectDrive} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Link2 className="h-4 w-4" />
                Conectar Google Drive
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={!connection ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
        <CardHeader>
          <CardTitle>Informações do Evento</CardTitle>
          <CardDescription>
            A estrutura de pastas será criada como: <b>ScoutFoto / Ramo / Nome da Atividade / Data</b>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ramo">Ramo <span className="text-destructive">*</span></Label>
              <Select value={ramo} onValueChange={setRamo} disabled={isUploading}>
                <SelectTrigger id="ramo">
                  <SelectValue placeholder="Selecione o Ramo" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map(b => (
                    <SelectItem key={b.key} value={b.key}>
                      <span className="flex items-center gap-2">
                        {b.icon} {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Data do Evento <span className="text-destructive">*</span></Label>
              <Input
                id="data"
                type="date"
                value={dataEvento}
                onChange={(e) => setDataEvento(e.target.value)}
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome da Atividade / Evento <span className="text-destructive">*</span></Label>
              <Input
                id="nome"
                placeholder="Ex: Acampamento de Inverno, Reunião Especial..."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={isUploading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fotos para Upload <span className="text-destructive">*</span></Label>
            
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept="image/*"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className={`p-3 rounded-full ${isDragging ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Upload className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">
                    {isDragging ? 'Solte as fotos aqui' : 'Arraste e solte fotos aqui'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para procurar no computador
                  </p>
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{files.length} {files.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}</span>
                  {!isUploading && (
                    <Button variant="ghost" size="sm" onClick={() => setFiles([])} className="h-8 text-destructive">
                      Limpar todas
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-[300px] overflow-y-auto p-1">
                  <AnimatePresence>
                    {files.map((file, index) => (
                      <motion.div
                        key={`${file.name}-${index}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative group aspect-square rounded-lg border overflow-hidden bg-muted"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                        />
                        {!isUploading && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          {isUploading && uploadProgress && (
            <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex justify-between text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Enviando arquivo {uploadProgress.current} de {uploadProgress.total}...
                </span>
                <span>{uploadProgress.progressPercentage}%</span>
              </div>
              <Progress value={uploadProgress.progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground truncate" title={uploadProgress.fileName}>
                Processando: {uploadProgress.fileName}
              </p>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end">
            <Button 
              size="lg" 
              className="w-full sm:w-auto gap-2" 
              onClick={handleUpload}
              disabled={isUploading || files.length === 0 || !connection}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando para o Drive...
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4" />
                  Salvar no Google Drive
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BancoImagens;
