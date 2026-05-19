      media_type: externalType,
      visibility: 'group',
      consent: true,
    };

    if (editingExternal) {
      const { error } = await supabase
        .from('images')
        .update(payload)
        .eq('id', editingExternal.id);

      if (error) {
        toast.error('Erro ao atualizar link: ' + error.message);
      } else {
        toast.success('Link atualizado!');
        setExternalOpen(false);
        setEditingExternal(null);
        fetchImages();
      }
    } else {
      const { error } = await supabase
        .from('images')
        .insert(payload);

      if (error) {
        toast.error('Erro ao salvar link: ' + error.message);
      } else {
        toast.success('Link externo adicionado!');
        setExternalOpen(false);
        fetchImages();
      }
    }
    
    setSavingExternal(false);
    setExternalTitle('');
    setExternalUrl('');
    setExternalType('document');
  };

  const openExternalEdit = (img: ImageData) => {
    setEditingExternal(img);
    setExternalTitle(img.filename || '');
    setExternalUrl(img.external_url || '');
    setExternalType(img.media_type as any);
    setExternalBranchId(img.branch_id);
    setExternalOpen(true);
  };


  if (!event && !loading) return null;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/events')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{event?.name}</h1>
            {event?.description && (
              <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
            )}
          </div>
          {event && canEditThisEvent && (
            <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-2">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {event && (
            <Badge variant="secondary" className="gap-1 font-normal">
              Cadastro: {format(new Date(event.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}
          {event?.event_date && (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Calendar className="h-3 w-3" />
              Evento: {format(parseLocalDate(event.event_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Badge>
          )}
          {event?.location && (
            <Badge variant="outline" className="gap-1 font-normal">
              <MapPin className="h-3 w-3" />
              Local: {event.location}
            </Badge>
          )}
          {branchInfo && (
            <Badge variant="secondary" className="font-normal">
              {branchInfo.icon} {branchInfo.display_name}
            </Badge>
          )}
          {event?.scout_group && (
            <Badge variant="outline" className="font-normal">
              {event.scout_group}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {(() => {
              const photoCount = images.filter(i => i.media_type === 'image' || i.media_type === 'photo').length;
              const videoCount = images.filter(i => i.media_type === 'video').length;
              const docCount = images.filter(i => i.media_type === 'document').length;
              return (
                <>
                  {photoCount > 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {photoCount} foto{photoCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {photoCount > 0 && (videoCount > 0 || docCount > 0) && <span>•</span>}
                  {videoCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Film className="h-3.5 w-3.5" />
                      {videoCount} vídeo{videoCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {(photoCount > 0 || videoCount > 0) && docCount > 0 && <span>•</span>}
                  {docCount > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {docCount} documento{docCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {photoCount === 0 && videoCount === 0 && docCount === 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" />
                      0 fotos
                    </span>
                  )}
                </>
              );
            })()}

          </div>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (canUploadEventPhotos || canUpload) && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <Card className="mb-6 border shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={handleUpload} className="space-y-4">
                {/* Drop zone / previews */}
                <div
                  className="relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById('event-file-input')?.click()}
                >
                  {previews.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3" onClick={e => e.stopPropagation()}>
                      {previews.map((p, i) => {
                        const isVid = ACCEPTED_VIDEO_TYPES.includes(files[i]?.type);
                        return (
                          <div key={i} className="relative">
                            {isVid ? (
                              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                                <Film className="h-8 w-8 text-muted-foreground" />
                              </div>
                            ) : (
                              <img src={p} alt={`Preview ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                            )}
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute right-0.5 top-0.5 h-5 w-5"
                              onClick={() => removeFile(i)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                      <div
                        className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                        onClick={() => document.getElementById('event-file-input')?.click()}
                      >
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Arraste ou clique para selecionar</p>
                      <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, MP4, MOV, WebM • Fotos até 10MB • Vídeos até 100MB</p>
                    </>
                  )}
                  <input
                    id="event-file-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                  />
                  <input
                    id="event-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => document.getElementById('event-camera-input')?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Tirar Foto
                </Button>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ramo *</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🌐 Todos os Ramos</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Visibilidade</Label>
                    <Select value={visibility} onValueChange={(v: 'private' | 'group' | 'public') => setVisibility(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">🔒 Privada</SelectItem>
                        <SelectItem value="group">👥 Grupo</SelectItem>
                        <SelectItem value="public" disabled={!!minorAge && parseInt(minorAge) > 0}>🌍 Pública</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea placeholder="Descreva a foto..." value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} className="min-h-[60px]" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Tags (separadas por vírgula)</Label>
                  <Input placeholder="acampamento, trilha" value={tags} onChange={e => setTags(e.target.value)} className="h-9" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Idade do menor</Label>
                    <Input type="number" min="1" max="17" placeholder="Se aplicável" value={minorAge} onChange={e => setMinorAge(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do responsável</Label>
                    <Input placeholder="Se menor" value={responsibleName} onChange={e => setResponsibleName(e.target.value)} className="h-9" />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs leading-snug text-muted-foreground">
                    Uso de imagem está de acordo com o "Termo de Autorização de Uso de Imagem (Paxtu)". Registro escoteiro (ficha de associado/Paxtu).
                  </p>
                </div>

                {uploading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Progress value={progress} className="h-2" />
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                      Enviando foto {uploadingIndex} de {files.length}... {progress}%
                    </p>
                  </motion.div>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowUpload(false); resetUploadForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={files.length === 0 || !branchId || uploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    Enviar {files.length > 1 ? `${files.length} arquivo${files.length !== 1 ? 's' : ''}` : ''}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <ImageIcon className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium text-foreground">Nenhuma mídia neste evento</p>
           <p className="mt-1 text-sm">
             {(canUploadEventPhotos || canUpload) ? 'Adicione fotos, vídeos ou links do Drive!' : 'Aguarde o upload de mídias.'}
           </p>
           {(canUploadEventPhotos || canUpload) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button className="gap-2" onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4" />
                Adicionar Foto
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowUpload(true)}>
                <Video className="h-4 w-4" />
                Adicionar Vídeo
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => { setEditingExternal(null); setExternalBranchId(event?.branch_id || 'all'); setExternalOpen(true); }}>
                <LinkIcon className="h-4 w-4" />
                Link Google Drive
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(canUploadEventPhotos || canUpload) && !showUpload && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowUpload(true)}>
                <Plus className="h-4 w-4" />
                Novo Upload
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingExternal(null); setExternalBranchId(event?.branch_id || 'all'); setExternalOpen(true); }}>
                <LinkIcon className="h-4 w-4" />
                Link Externo
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                className="group relative cursor-pointer overflow-hidden rounded-xl bg-muted"
                onClick={() => handleViewImage(img)}
              >
                <div className="aspect-square overflow-hidden">
                  {img.external_url ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-4 text-center">
                      <div className="mb-2 rounded-full bg-primary/10 p-3 text-primary">
                        {img.media_type === 'video' ? <Film className="h-6 w-6" /> : 
                         img.media_type === 'image' ? <ImageIcon className="h-6 w-6" /> : 
                         <FileText className="h-6 w-6" />}
                      </div>
                      <p className="text-xs font-medium line-clamp-2 px-1">{img.filename}</p>
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ExternalLink className="h-3 w-3" />
                        Google Drive
                      </div>
                    </div>
                  ) : img.media_type === 'video' ? (
                  <div className="relative flex h-full w-full items-center justify-center bg-muted">
                    {imageUrls[img.id] ? (
                      <video
                        src={imageUrls[img.id]}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                        playsInline
                        onLoadedData={(e) => {
                          const vid = e.currentTarget;
                          vid.currentTime = 0.5;
                        }}
                      />
                    ) : (
                      <Film className="h-10 w-10 text-muted-foreground" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white">
                        <Video className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                ) : (thumbUrls[img.id] || imageUrls[img.id]) ? (
                  <img
                    src={thumbUrls[img.id] || imageUrls[img.id]}
                    alt={img.caption || img.filename}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-2xl">📷</span>
                  </div>
                )}
              </div>
              {img.media_type === 'video' && (
                <div className="absolute left-2 top-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    {img.external_url ? <LinkIcon className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                    {img.external_url ? 'Link' : 'Vídeo'}
                  </Badge>
                </div>
              )}
              {img.media_type === 'document' && (
                <div className="absolute left-2 top-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <FileText className="h-3 w-3" />
                    Documento
                  </Badge>
                </div>
              )}

              {img.minor_age && (
                <div className="absolute right-2 top-2">
                  <Badge variant="destructive" className="text-xs">Menor</Badge>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Media Viewer Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl border-0 p-0 overflow-hidden">




          {selectedImage && (
            <div>

              <div className="bg-black">
                {selectedImage.external_url ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-white min-h-[40vh]">
                    <div className="mb-4 rounded-full bg-white/10 p-6">
                      <LinkIcon className="h-12 w-12" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{selectedImage.filename}</h3>
                    <p className="text-white/60 mb-6 max-w-md">Este é um link externo do Google Drive.</p>
                    <Button 
                      className="gap-2 bg-primary hover:bg-primary/90" 
                      onClick={() => window.open(selectedImage.external_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir no Google Drive
                    </Button>
                  </div>
                ) : (imageUrls[selectedImage.id] && selectedImage.media_type === 'video' ? (
                  <video
                    src={imageUrls[selectedImage.id]}
                    controls
                    className="mx-auto max-h-[70vh] w-full"
                    autoPlay
                  />
                ) : imageUrls[selectedImage.id] ? (
                  <img
                    src={imageUrls[selectedImage.id]}
                    alt={selectedImage.caption || ''}
                    className="mx-auto max-h-[70vh] object-contain"
                  />
                ) : null)}
              </div>

              <div className="p-6">
                {selectedImage.caption && (
                  <p className="mb-3 text-lg font-medium">{selectedImage.caption}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(selectedImage.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {selectedImage.views} views
                  </div>
                </div>
                {selectedImage.tags && selectedImage.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedImage.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  {selectedImage.external_url ? (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(selectedImage.external_url!, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                      Acessar Link
                    </Button>
                  ) : (
                    canDownloadEventPhotos && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload(selectedImage)}>
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    )
                  )}
                  
                  {selectedImage.external_url && canEditThisEvent && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => { openExternalEdit(selectedImage); setSelectedImage(null); }}>
                      <Pencil className="h-4 w-4" />
                      Editar Link
                    </Button>
                  )}

                  {(canDeleteEventPhotos || user?.id === selectedImage.user_id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => { setDeleteImage(selectedImage); setSelectedImage(null); }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  )}
                </div>

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteImage} onOpenChange={(open) => !open && setDeleteImage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteImage?.external_url ? 'este link' : 'esta foto'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteImage?.external_url 
                ? 'Isso removerá apenas a referência ao link externo.' 
                : 'Esta ação removerá permanentemente o arquivo do servidor.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteImage) handleDeleteImage(deleteImage); setDeleteImage(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FAB para adicionar fotos quando já existem fotos */}
      {images.length > 0 && (canUploadEventPhotos || canUpload) && !showUpload && (
        <button
          onClick={() => { setShowUpload(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
          aria-label="Adicionar Foto"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Edit Event Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do evento</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required maxLength={200} className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Detalhes da atividade..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={editEventDate} onChange={e => setEditEventDate(e.target.value)} min="1900-01-01" max="2100-12-31" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} className="h-12 text-base" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ramo (opcional)</Label>
              <Select value={editBranchId || 'all'} onValueChange={setEditBranchId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Todos os ramos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os ramos</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grupo Escoteiro (opcional)</Label>
              <Input value={editScoutGroup} onChange={e => setEditScoutGroup(e.target.value)} placeholder="Ex: GE 015" className="h-12 text-base" />
            </div>
            <Button type="submit" disabled={savingEdit} className="w-full h-12 font-semibold">
              {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* External Link Dialog */}
      <Dialog open={externalOpen} onOpenChange={setExternalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExternal ? 'Editar Link Externo' : 'Adicionar Link Externo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExternalSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Título / Nome do Arquivo</Label>
              <Input 
                value={externalTitle} 
                onChange={e => setExternalTitle(e.target.value)} 
                placeholder="Ex: Documentos do Acampamento" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>URL do Google Drive</Label>
              <Input 
                value={externalUrl} 
                onChange={e => setExternalUrl(e.target.value)} 
                placeholder="https://drive.google.com/..." 
                required 
              />
              <p className="text-[10px] text-muted-foreground">Certifique-se de que o link tenha permissão de visualização.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Mídia</Label>
                <Select value={externalType} onValueChange={(v: any) => setExternalType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Foto</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ramo</Label>
                <Select value={externalBranchId} onValueChange={setExternalBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Ramos</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setExternalOpen(false)} disabled={savingExternal}>Cancelar</Button>
              <Button type="submit" disabled={savingExternal}>
                {savingExternal ? 'Salvando...' : (editingExternal ? 'Salvar Alterações' : 'Adicionar Link')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EventDetail;


