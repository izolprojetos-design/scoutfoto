import lobinho from '@/assets/branch-lobinho.jpg';
import escoteiro from '@/assets/branch-escoteiro.jpg';
import senior from '@/assets/branch-senior.jpg';
import pioneiro from '@/assets/branch-pioneiro.jpg';
import voluntario from '@/assets/branch-voluntario.jpg';

const map: Record<string, string> = {
  lobinho,
  escoteiro,
  senior,
  'sênior': senior,
  pioneiro,
  voluntario,
  'voluntário': voluntario,
};

/** Returns a photo-realistic image URL for a branch key/name, or null. */
export function getBranchImage(branchKeyOrName?: string | null): string | null {
  if (!branchKeyOrName) return null;
  return map[branchKeyOrName.toLowerCase()] || null;
}
