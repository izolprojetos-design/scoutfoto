
import React from 'react';
import ScoutPhoto from './ScoutPhoto';
import { getInitials, stringToColor } from '@/avatarUtils';
import { cn } from '@/lib/utils';

// Path was corrected to '@/avatarUtils' but it should be '@/lib/avatarUtils'
// Wait, I created it in src/lib/avatarUtils.ts

import { getInitials, stringToColor } from '@/lib/avatarUtils';

interface ScoutAvatarProps {
  name: string;
  photoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onBroken?: () => void;
}

const ScoutAvatar = ({ 
  name, 
  photoUrl, 
  className, 
  fallbackClassName,
  onClick,
  onBroken 
}: ScoutAvatarProps) => {
  const initials = getInitials(name);
  const bgColor = stringToColor(name);

  const fallback = (
    <div 
      className={cn(
        "flex items-center justify-center rounded-full text-white font-bold select-none",
        className,
        fallbackClassName
      )}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  );

  return (
    <ScoutPhoto
      photoUrl={photoUrl}
      alt={name}
      className={cn("rounded-full object-cover", className)}
      onClick={onClick}
      onBroken={onBroken}
      fallback={fallback}
    />
  );
};

export default ScoutAvatar;
