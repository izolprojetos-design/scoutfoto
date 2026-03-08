import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Search, ArrowLeft, Calendar, User, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImageData {
  id: string;
  filename: string;
  storage_path: string;
  caption: string | null;
  tags: string[] | null;
  minor_age: number | null;
  visibility: string;
  created_at: string;
  user_id: string;
  profiles?: { name: string } | null;
}

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

const Gallery = () => {
  const { branchKey } = useParams<{ branchKey: string }>();
  const { isAdmin, hasRole } = useAuth();
  const navigate = useNavigate();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [filteredImages, setFilteredImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      const { data: branchData } = await supabase
        .from('branches')
        .select('*')
        .eq('key', branchKey)
        .single();

      if (!branchData) {
        navigate('/dashboard');
        return;
      }
      setBranch(branchData);

      const { data: imagesData } = await supabase
        .from('images')
        .select('*')
        .eq('branch_id', branchData.id)
        .order('created_at', { ascending: false });

      let filtered = imagesData || [];

      // Filter minor images - only admin/chefes can see
      if (!isAdmin && !hasRole('admin')) {
        // Check if user has chefes role - for now, filter by branch
        filtered = filtered.filter(img => img.minor_age === null);
      }

      setImages(filtered);
      setFilteredImages(filtered);

      // Get signed URLs
      const urls: Record<string, string> = {};
      for (const img of filtered) {
        const { data } = await supabase.storage
          .from('images')
          .createSignedUrl(img.storage_path, 3600);
        if (data?.signedUrl) urls[img.id] = data.signedUrl;
      }
      setImageUrls(urls);
      setLoading(false);
    };
    fetchData();
  }, [branchKey]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredImages(images);
      return;
    }
    const q = search.toLowerCase();
    setFilteredImages(
      images.filter(img =>
        img.caption?.toLowerCase().includes(q) ||
        img.tags?.some(t => t.toLowerCase().includes(q)) ||
        img.filename.toLowerCase().includes(q)
      )
    );
  }, [search, images]);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              {branch?.icon} {branch?.display_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {filteredImages.length} {filteredImages.length === 1 ? 'foto' : 'fotos'}
            </p>
          </div>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <span className="mb-2 text-4xl">📷</span>
          <p>Nenhuma foto encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredImages.map((img, index) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
              className="group cursor-pointer overflow-hidden rounded-xl bg-muted"
              onClick={() => setSelectedImage(img)}
            >
              <div className="aspect-square overflow-hidden">
                {imageUrls[img.id] ? (
                  <img
                    src={imageUrls[img.id]}
                    alt={img.caption || img.filename}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <span className="text-2xl">📷</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl border-0 p-0 overflow-hidden">
          {selectedImage && (
            <div>
              <div className="bg-black">
                {imageUrls[selectedImage.id] && (
                  <img
                    src={imageUrls[selectedImage.id]}
                    alt={selectedImage.caption || ''}
                    className="mx-auto max-h-[70vh] object-contain"
                  />
                )}
              </div>
              <div className="p-6">
                {selectedImage.caption && (
                  <p className="mb-3 text-lg font-medium">{selectedImage.caption}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(selectedImage.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                </div>
                {selectedImage.tags && selectedImage.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedImage.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Gallery;
