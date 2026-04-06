import campingImg from '@/assets/events/camping.jpg';
import celebrationImg from '@/assets/events/celebration.jpg';
import activitiesImg from '@/assets/events/activities.jpg';
import hikingImg from '@/assets/events/hiking.jpg';
import meetingImg from '@/assets/events/meeting.jpg';

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

const ALL_IMAGES = [campingImg, celebrationImg, activitiesImg, hikingImg, meetingImg];

export function getEventCoverImage(eventName: string): string {
  const lower = eventName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const entry of IMAGE_KEYWORDS) {
    for (const kw of entry.keywords) {
      const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes(normalizedKw)) {
        return entry.image;
      }
    }
  }

  // Fallback: pick a consistent image based on the name hash
  let hash = 0;
  for (let i = 0; i < eventName.length; i++) {
    hash = ((hash << 5) - hash + eventName.charCodeAt(i)) | 0;
  }
  return ALL_IMAGES[Math.abs(hash) % ALL_IMAGES.length];
}
