import { Badge } from '@/components/ui/badge';
import { useUserSection } from '@/hooks/useUserSection';

const SectionIndicator = () => {
  const { sectionLabel, isRestricted } = useUserSection();

  if (!sectionLabel) return null;

  return (
    <Badge variant={isRestricted ? 'default' : 'secondary'} className="text-xs gap-1 font-medium">
      {sectionLabel}
    </Badge>
  );
};

export default SectionIndicator;
