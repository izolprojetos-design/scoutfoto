import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  voluntario: 'Voluntário',
  viewer: 'Visitante',
  parent: 'Pai/Mãe',
  dirigente_gestor: 'Dirigente Gestor',
  chefe: 'Chefe',
  dirigente: 'Dirigente',
};

const SectionIndicator = () => {
  const { roles } = useAuth();

  if (!roles || roles.length === 0) return null;

  // Show the highest-priority role
  const priority = ['admin', 'voluntario', 'dirigente_gestor', 'chefe', 'dirigente', 'parent', 'viewer'];
  const mainRole = priority.find(r => roles.includes(r as any)) || roles[0];
  const label = ROLE_LABELS[mainRole] || mainRole;
  const isAdmin = mainRole === 'admin';

  return (
    <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-xs gap-1 font-medium">
      {label}
    </Badge>
  );
};

export default SectionIndicator;
