import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getPrimaryRole, ROLE_LABELS } from '@/lib/userRoles';

const SectionIndicator = () => {
  const { roles } = useAuth();

  if (!roles || roles.length === 0) return null;

  const mainRole = getPrimaryRole(roles);
  const isAdmin = mainRole === 'admin';

  return (
    <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-xs gap-1 font-medium">
      {ROLE_LABELS[mainRole]}
    </Badge>
  );
};

export default SectionIndicator;
