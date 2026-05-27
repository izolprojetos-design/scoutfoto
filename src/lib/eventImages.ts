import campingImg from '@/assets/events/camping.jpg';
import celebrationImg from '@/assets/events/celebration.jpg';
import activitiesImg from '@/assets/events/activities.jpg';
import hikingImg from '@/assets/events/hiking.jpg';
import meetingImg from '@/assets/events/meeting.jpg';

const IMAGE_MAP: Record<string, string> = {
  'Acampamento': campingImg,
  'Celebração': celebrationImg,
  'Atividades': activitiesImg,
  'Trilha': hikingImg,
  'Reunião': meetingImg,
};

const IMAGE_KEYWORDS: { keywords: string[]; image: string }[] = [
  {
    keywords: ['acampamento', 'acampapais', 'bivaque', 'bivak', 'pernoite', 'camping', 'barraca'],
    image: campingImg,
  },
  {
    keywords: ['dia da mulher', 'comemoração', 'celebração', 'festa', 'aniversário', 'natal', 'páscoa', 'confraternização'],
    image: celebrationImg,
  },
  {
    keywords: ['retorno', 'abertura', 'início', 'inauguração', 'atividade', 'reunião', 'encontro'],
    image: activitiesImg,
  },
  {
    keywords: ['trilha', 'caminhada', 'excursão', 'exploração', 'jornada', 'raid'],
    image: hikingImg,
  },
  {
    keywords: ['fogão', 'fogata', 'fogo', 'conselho', 'cerimônia', 'promessa', 'investidura'],
    image: meetingImg,
  },
];

const ALL_IMAGES = [campingImg, celebrationImg, activitiesImg, hikingImg, meetingImg].filter(Boolean);

/**
 * Returns a cover image for an event based on its name.
 * Uses keywords first, then a deterministic hash-based selection to ensure 
 * consistency per event but variety between events, avoiding immediate repeats.
 */
export function getEventCoverImage(eventName: string): string {
  // Validation for empty library
  if (!ALL_IMAGES || ALL_IMAGES.length === 0) {
    console.warn('Event image library is empty or failed to load.');
    return ''; 
  }

  const lower = eventName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const entry of IMAGE_KEYWORDS) {
    for (const kw of entry.keywords) {
      const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes(normalizedKw)) {
        const imgName = Object.keys(IMAGE_MAP).find(key => IMAGE_MAP[key] === entry.image) || 'Keyword Match';
        console.log(`[EventImage] Selected "${imgName}" for event "${eventName}" via keyword.`);
        return entry.image;
      }
    }
  }

  // Deterministic but distributed selection based on name hash
  // This ensures same name gets same image, but variety among different names
  // and avoids the "truly random" jumping on every re-render.
  let hash = 0;
  for (let i = 0; i < eventName.length; i++) {
    hash = ((hash << 5) - hash) + eventName.charCodeAt(i);
    hash |= 0;
  }
  
  const index = Math.abs(hash) % ALL_IMAGES.length;
  const selectedImage = ALL_IMAGES[index];
  
  const imgName = Object.keys(IMAGE_MAP).find(key => IMAGE_MAP[key] === selectedImage) || `Index ${index}`;
  console.log(`[EventImage] Selected "${imgName}" for event "${eventName}" via random distribution.`);
  
  return selectedImage;
}
