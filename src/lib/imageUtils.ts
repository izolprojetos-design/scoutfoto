import { getAvatarUrl } from './avatarUtils';
import { getEventCoverImage } from './eventImages';

/**
 * Main utility to get either a thematic image or a generated avatar for any title.
 * If the title looks like a person's name (two or more words, no keywords), it prefers an avatar.
 * Otherwise, it prefers a thematic image.
 */
export function getImageForTitle(title: string, id?: string): string {
  if (!title) return '';

  const lower = title.toLowerCase();
  const keywords = [
    'acampamento', 'trilha', 'reunião', 'atividade', 'festa', 
    'celebração', 'encontro', 'aula', 'projeto', 'evento'
  ];

  const hasKeyword = keywords.some(kw => lower.includes(kw));
  
  // If it has scouting keywords, use the event image logic
  if (hasKeyword) {
    return getEventCoverImage(title, id);
  }

  // If it's a short title or seems like a name, use an avatar
  return getAvatarUrl(title);
}
