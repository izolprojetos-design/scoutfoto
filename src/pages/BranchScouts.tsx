import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCurrentBranch, formatAge, ALL_CATEGORIES } from '@/lib/scoutUtils';

interface Scout {
  id: string;
  name: string;
  birth_date: string;
  scout_group: string;
  photo_url: string | null;
  manual_branch: string | null;
}

interface BranchData {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

interface Subgroup {
  id: string;
  name: string;
  branch_key: string;
}

const BranchScouts = () => {
  const { branchKey } = useParams<{ branchKey: string }>();
  const navigate = useNavigate();
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchData, setBranchData] = useState<BranchData | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ name: string; url: string } | null>(null);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: branchRes }, { data: scoutRes }, { data: subgroupData }] = await Promise.all([
        supabase.from('branches').select('*').eq('key', branchKey!).single(),
        supabase.from('scouts').select('*').order('name'),
        supabase.from('subgroups').select('*'),
      ]);

      if (branchRes) {
        setBranchData(branchRes);
      } else {
        navigate('/dashboard');
        return;
      }

      if (scoutRes) {
        const filtered = scoutRes.filter(s => {
          if (s.manual_branch) return s.manual_branch === branchKey;
          const branch = getCurrentBranch(new Date(s.birth_date));
          return branch?.key === branchKey;
        });
        setScouts(filtered);
      }
      setLoading(false);
    };
    fetchData();
  }, [branchKey]);

  if (!branchData && !loading) {
    return null;
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {branchData?.icon} {branchData?.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">{scouts.length} integrantes</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : scouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <span className="mb-2 text-4xl">{branchData?.icon}</span>
          <p>Nenhum integrante cadastrado neste ramo</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {scouts.map((scout, index) => (
            <motion.div
              key={scout.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.03, 0.5) }}
              className="group cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              onClick={() => scout.photo_url && setSelectedPhoto({ name: scout.name, url: scout.photo_url })}
            >
              <div className="aspect-square overflow-hidden bg-muted">
                {scout.photo_url ? (
                  <img
                    src={scout.photo_url}
                    alt={scout.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <User className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold truncate">{scout.name}</p>
                <p className="text-xs text-muted-foreground">{formatAge(new Date(scout.birth_date))}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-md flex flex-col items-center gap-4">
          {selectedPhoto && (
            <>
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                className="w-64 h-64 rounded-xl object-cover shadow-lg"
              />
              <p className="text-lg font-semibold">{selectedPhoto.name}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default BranchScouts;
