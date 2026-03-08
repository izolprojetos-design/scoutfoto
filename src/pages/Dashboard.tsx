import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/components/AppLayout';
import { motion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';

interface BranchWithCount {
  id: string;
  key: string;
  display_name: string;
  icon: string;
  sort_order: number;
  imageCount: number;
}

const Dashboard = () => {
  const [branches, setBranches] = useState<BranchWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBranches = async () => {
      const { data: branchData } = await supabase
        .from('branches')
        .select('*')
        .order('sort_order');

      if (branchData) {
        const withCounts = await Promise.all(
          branchData.map(async (branch) => {
            const { count } = await supabase
              .from('images')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id);
            return { ...branch, imageCount: count || 0 };
          })
        );
        setBranches(withCounts);
      }
      setLoading(false);
    };
    fetchBranches();
  }, []);

  const cardColors = [
    'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20',
    'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20',
    'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20',
    'from-red-500/10 to-red-600/5 hover:from-red-500/20',
    'from-purple-500/10 to-purple-600/5 hover:from-purple-500/20',
    'from-teal-500/10 to-teal-600/5 hover:from-teal-500/20',
  ];

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Selecione um ramo para ver as fotos das atividades
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch, index) => (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`cursor-pointer border-0 bg-gradient-to-br ${cardColors[index % cardColors.length]} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
                onClick={() => navigate(`/gallery/${branch.key}`)}
              >
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <span className="mb-4 text-5xl">{branch.icon}</span>
                  <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>
                    {branch.display_name}
                  </h2>
                  <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                    <span>{branch.imageCount} {branch.imageCount === 1 ? 'foto' : 'fotos'}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Dashboard;
