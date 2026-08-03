import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getPrimaryRole, ROLE_LABELS } from '@/lib/userRoles';
import { ShieldCheck } from 'lucide-react';

const SectionIndicator = () => {
  const { roles, isSimulating } = useAuth();

  if (!roles || roles.length === 0) return null;

  const mainRole = getPrimaryRole(roles);
  const isAdmin = mainRole === 'admin';

  return (
    <div className="flex items-center gap-2">
      <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-xs gap-1 font-medium">
        {ROLE_LABELS[mainRole]}
      </Badge>
      {isSimulating && (
        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-50 h-5 px-1.5 animate-pulse gap-1">
          <ShieldCheck className="h-3 w-3" />
          SIMULAÇÃO
        </Badge>
      )}
    </div>
  );
};

export default SectionIndicator;
