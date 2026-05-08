import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { getSignedPhotoUrl } from '@/lib/storageUtils';
import { parseLocalDate, getCurrentBranch, getNextBranchChange, formatTimeLeft, formatAge } from '@/lib/scoutUtils';
import { getGroupLogoDataUrl } from '@/lib/groupLogo';

interface ScoutLike {
  id: string;
  name: string;
  birth_date: string;
  created_at: string;
  section?: string | null;
  scout_group?: string | null;
  registration_id?: string | null;
  phone?: string | null;
  notes?: string | null;
  transition_date?: string | null;
  photo_url?: string | null;
}

interface Guardian {
  name: string;
  email?: string | null;
  phone?: string | null;
}

const PRIMARY: [number, number, number] = [25, 80, 140];
const MUTED: [number, number, number] = [110, 110, 110];

const imageCache = new Map<string, Promise<string | null>>();

export async function fetchImageDataUrl(url: string): Promise<string | null> {
  const cached = imageCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string | null>((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    } catch { return null; }
  })();

  imageCache.set(url, promise);
  return promise;
}

export interface PdfExportOptions {
  /** When true, the PDF is not saved; instead a data URL is returned. */
  preview?: boolean;
}

export async function exportScoutProfilePdf(
  scout: ScoutLike,
  guardians: Guardian[] = [],
  options: PdfExportOptions = {},
): Promise<string | void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  const birth = parseLocalDate(scout.birth_date);
  const created = new Date(scout.created_at);
  const branch = getCurrentBranch(birth);
  const next = getNextBranchChange(birth);
  const ageStr = formatAge(birth);
  const yearsInGroup = differenceInYears(new Date(), created);
  const monthsInGroup = differenceInMonths(new Date(), created);

  // ===== COVER =====
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 55, 'F');

  // Logo do grupo (uploaded via Admin > Identidade, com fallback ao bundled)
  const logoDataUrl = await getGroupLogoDataUrl();
  const textLeft = logoDataUrl ? margin + 30 : margin;
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', margin, 12, 25, 25, undefined, 'FAST'); } catch { /* ignore */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PERFIL DO INTEGRANTE', textLeft, 22);
  doc.setFontSize(18);
  doc.text(scout.name.toUpperCase(), textLeft, 34, { maxWidth: pageW - textLeft - margin });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const subtitle = [scout.section, scout.scout_group].filter(Boolean).join(' • ');
  if (subtitle) doc.text(subtitle, textLeft, 47);

  // Photo
  let photoY = 70;
  if (scout.photo_url) {
    const signed = await getSignedPhotoUrl(scout.photo_url);
    if (signed) {
      const dataUrl = await fetchImageDataUrl(signed);
      if (dataUrl) {
        try {
          const fmt = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(dataUrl, fmt, margin, photoY, 45, 45, undefined, 'FAST');
        } catch { /* ignore */ }
      }
    }
  }

  // Stats next to photo
  const statsX = margin + 55;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Resumo', statsX, photoY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines: string[] = [];
  lines.push(`Idade: ${ageStr}`);
  lines.push(`Nascimento: ${birth.toLocaleDateString('pt-BR')}`);
  lines.push(`No grupo: ${yearsInGroup >= 1 ? `${yearsInGroup} ${yearsInGroup === 1 ? 'ano' : 'anos'}` : `${monthsInGroup} ${monthsInGroup === 1 ? 'mês' : 'meses'}`}`);
  if (branch) lines.push(`Ramo atual: ${branch.name}`);
  if (next) lines.push(`Próximo ramo: ${next.branch.name} em ${formatTimeLeft(next.monthsLeft, next.daysLeft)}`);
  if (scout.registration_id) lines.push(`ID: ${scout.registration_id}`);
  if (scout.phone) lines.push(`Celular: ${scout.phone}`);
  lines.forEach((l, i) => doc.text(l, statsX, photoY + 13 + i * 5.5));

  let cursorY = photoY + 55;

  // Notes
  if (scout.notes) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Observações', margin, cursorY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(scout.notes, pageW - margin * 2);
    doc.text(wrapped, margin, cursorY + 6);
    cursorY += 6 + wrapped.length * 5 + 6;
  }

  // Guardians table
  if (guardians.length > 0) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Responsáveis', margin, cursorY);
    autoTable(doc, {
      startY: cursorY + 3,
      head: [['Nome', 'E-mail', 'Telefone']],
      body: guardians.map(g => [g.name, g.email || '—', g.phone || '—']),
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
      theme: 'striped',
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== ACHIEVEMENTS =====
  const TYPE_LABELS: Record<string, string> = {
    especialidade: 'Especialidade',
    insignia: 'Insígnia',
    distintivo: 'Distintivo',
    conquista: 'Conquista',
    outro: 'Outro',
  };
  const { data: achievements } = await supabase
    .from('scout_achievements')
    .select('id, type, name, achievement_date, description')
    .eq('scout_id', scout.id)
    .order('achievement_date', { ascending: false });

  if (achievements && achievements.length > 0) {
    if (cursorY > pageH - 60) { doc.addPage(); cursorY = margin; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Conquistas e Insígnias', margin, cursorY);
    autoTable(doc, {
      startY: cursorY + 3,
      head: [['Data', 'Tipo', 'Nome', 'Descrição']],
      body: achievements.map((a: any) => [
        format(parseLocalDate(a.achievement_date), 'dd/MM/yyyy', { locale: ptBR }),
        TYPE_LABELS[a.type] || a.type,
        a.name,
        a.description || '—',
      ]),
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, valign: 'top' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 28 },
        2: { cellWidth: 50 },
        3: { cellWidth: 'auto' },
      },
      margin: { left: margin, right: margin },
      theme: 'striped',
    });
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== TIMELINE =====
  // Build same dataset as ScoutTimeline
  type TItem = { date: Date; type: string; title: string; description?: string };
  const items: TItem[] = [];

  items.push({ date: created, type: 'Ingresso', title: 'Ingresso no grupo', description: scout.section || undefined });

  if (scout.transition_date) {
    items.push({ date: parseLocalDate(scout.transition_date), type: 'Transição', title: 'Transição de ramo' });
  }

  const { data: audits } = await supabase
    .from('audit_logs')
    .select('id, action, created_at, before_data, after_data, details')
    .or(`details->>scout_id.eq.${scout.id},after_data->>scout_id.eq.${scout.id},details->>id.eq.${scout.id}`)
    .in('action', ['section_change', 'data_update'])
    .order('created_at', { ascending: false })
    .limit(200);
  (audits || []).forEach((a: any) => {
    const before = a.before_data?.section;
    const after = a.after_data?.section;
    if (a.action === 'section_change' || (before && after && before !== after)) {
      items.push({
        date: new Date(a.created_at),
        type: 'Seção',
        title: 'Mudança de seção',
        description: before && after ? `${before} → ${after}` : undefined,
      });
    }
  });

  const { data: photos } = await supabase
    .from('scout_photos')
    .select('id, created_at')
    .eq('scout_id', scout.id)
    .order('created_at', { ascending: false })
    .limit(500);
  const byMonth = new Map<string, number>();
  (photos || []).forEach((p: any) => {
    const d = new Date(p.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(k, (byMonth.get(k) || 0) + 1);
  });
  byMonth.forEach((count, key) => {
    const [y, m] = key.split('-').map(Number);
    items.push({
      date: new Date(y, m - 1, 15),
      type: 'Fotos',
      title: `${count} ${count === 1 ? 'foto' : 'fotos'}`,
      description: format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: ptBR }),
    });
  });

  const today = new Date();
  let yr = created.getFullYear();
  while (yr <= today.getFullYear()) {
    const bday = new Date(yr, birth.getMonth(), birth.getDate());
    if (bday >= created && bday <= today) {
      items.push({ date: bday, type: 'Aniversário', title: `${yr - birth.getFullYear()}º aniversário` });
    }
    yr++;
  }

  (achievements || []).forEach((a: any) => {
    items.push({
      date: parseLocalDate(a.achievement_date),
      type: 'Conquista',
      title: a.name,
      description: a.description || undefined,
    });
  });

  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  doc.addPage();
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 18, 'F');
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', margin, 2, 14, 14, undefined, 'FAST'); } catch { /* ignore */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Linha do Tempo', logoDataUrl ? margin + 18 : margin, 12);

  autoTable(doc, {
    startY: 24,
    head: [['Data', 'Tipo', 'Marco']],
    body: items.map(i => [
      format(i.date, "dd/MM/yyyy", { locale: ptBR }),
      i.type,
      i.description ? `${i.title}\n${i.description}` : i.title,
    ]),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, valign: 'top' },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 28 },
      2: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    theme: 'striped',
  });

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    const stamp = `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ScoutFoto`;
    doc.text(stamp, margin, pageH - 8);
    doc.text(`${p}/${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  const safeName = scout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`perfil-${safeName || 'integrante'}.pdf`);
}
