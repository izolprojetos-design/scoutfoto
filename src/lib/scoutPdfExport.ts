import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { getSignedPhotoUrl } from '@/lib/storageUtils';
import { parseLocalDate, getCurrentBranch, getNextBranchChange, formatTimeLeft, formatAge } from '@/lib/scoutUtils';
import { getGroupLogoDataUrl } from '@/lib/groupLogo';
import { formatPhoneBR } from '@/lib/formatting';

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
  admission_date?: string | null;
  photo_url?: string | null;

}

interface Guardian {
  name: string;
  email?: string | null;
  phone?: string | null;
}

const PRIMARY: [number, number, number] = [245, 245, 245]; // Light Gray (was Forest Green)
const SECONDARY_GREEN: [number, number, number] = [100, 100, 100]; // Darker gray for accent
const MUTED: [number, number, number] = [110, 110, 110];
const BLACK: [number, number, number] = [40, 40, 40];
const WHITE: [number, number, number] = [255, 255, 255];

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
  const created = scout.admission_date ? parseLocalDate(scout.admission_date) : new Date(scout.created_at);
  const branch = getCurrentBranch(birth);
  const isAdult = branch?.key === 'voluntario' || differenceInMonths(new Date(), birth) >= 252;
  const next = !isAdult ? getNextBranchChange(birth) : null;
  const ageStr = formatAge(birth);
  const yearsInGroup = differenceInYears(new Date(), created);
  const monthsInGroup = differenceInMonths(new Date(), created);

  // ===== HEADER (Shared Style) =====
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 55, 'F'); // Increased header height for more professional look
  doc.setFillColor(...SECONDARY_GREEN);
  doc.rect(0, 55, pageW, 2, 'F'); // Bottom accent line

  const logoDataUrl = await getGroupLogoDataUrl();
  if (logoDataUrl) {
    try { 
      // Circle background for logo
      doc.setFillColor(...WHITE);
      doc.circle(margin + 15, 27, 20, 'F');
      doc.addImage(logoDataUrl, 'PNG', margin + 3, 15, 24, 24, undefined, 'FAST'); 
    } catch { /* ignore */ }
  }

  const textLeft = margin + 42;
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PERFIL DO INTEGRANTE', textLeft, 22);
  doc.setFontSize(16);
  doc.text(scout.name.toUpperCase(), textLeft, 35, { maxWidth: pageW - textLeft - margin });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const subtitle = [scout.section, scout.scout_group, '12º GEMC'].filter(Boolean).join(' • ');
  if (subtitle) doc.text(subtitle, textLeft, 45);

  // Photo
  let photoY = 67;
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
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Informações Gerais', statsX, photoY + 5);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(statsX, photoY + 7, statsX + 40, photoY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines: string[] = [];
  lines.push(`Idade: ${ageStr}`);
  lines.push(`Nascimento: ${birth.toLocaleDateString('pt-BR')}`);
  lines.push(`No grupo: ${yearsInGroup >= 1 ? `${yearsInGroup} ${yearsInGroup === 1 ? 'ano' : 'anos'}` : `${monthsInGroup} ${monthsInGroup === 1 ? 'mês' : 'meses'}`}`);
  if (branch) lines.push(`Ramo atual: ${branch.name}`);
  if (next) lines.push(`Próximo ramo: ${next.branch.name} em ${formatTimeLeft(next.monthsLeft, next.daysLeft)}`);
  if (scout.registration_id) lines.push(`ID: ${scout.registration_id}`);
  if (scout.phone) lines.push(`Celular: ${formatPhoneBR(scout.phone)}`);
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
      body: guardians.map(g => [g.name, g.email || '—', formatPhoneBR(g.phone) || '—']),
      headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold', fontSize: 9 },
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
      headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold', fontSize: 9 },
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
  doc.rect(0, 0, pageW, 40, 'F');
  doc.setFillColor(...SECONDARY_GREEN);
  doc.rect(0, 40, pageW, 1.5, 'F');

  if (logoDataUrl) {
    try { 
      doc.setFillColor(...WHITE);
      doc.circle(margin + 12, 20, 15, 'F');
      doc.addImage(logoDataUrl, 'PNG', margin + 3, 11, 18, 18, undefined, 'FAST'); 
    } catch { /* ignore */ }
  }
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('LINHA DO TEMPO', margin + 35, 18);
  doc.setFontSize(16);
  doc.text(scout.name.toUpperCase(), margin + 35, 30);

  autoTable(doc, {
    startY: 48,
    head: [['Data', 'Tipo', 'Marco']],
    body: items.map(i => [
      format(i.date, "dd/MM/yyyy", { locale: ptBR }),
      i.type,
      i.description ? `${i.title}\n${i.description}` : i.title,
    ]),
    headStyles: { fillColor: [80, 80, 80], textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
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
  if (options.preview) return doc.output('datauristring');
  doc.save(`perfil-${safeName || 'integrante'}.pdf`);
}

// ────────────────────────────────────────────────────────────────────────────
// Photo folder PDF (per scout, per date) — extracted from ScoutFolders.tsx
// so it can be reused by the live export and by the preview panel.
// ────────────────────────────────────────────────────────────────────────────
export interface PhotoLike {
  id: string;
  storage_path: string;
  created_at: string;
}

export async function exportScoutFolderPdf(
  scoutName: string,
  dateKey: string,
  photos: PhotoLike[],
  signedUrls: Record<string, string>,
  options: PdfExportOptions = {},
): Promise<string | void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 15;
  
  const logoDataUrl = await getGroupLogoDataUrl();

  // Header Shared Style
  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 0, pageW, 55, 'F');
  pdf.setFillColor(...SECONDARY_GREEN);
  pdf.rect(0, 55, pageW, 2, 'F');

  if (logoDataUrl) {
    try { 
      pdf.setFillColor(...WHITE);
      pdf.circle(margin + 15, 27, 20, 'F');
      pdf.addImage(logoDataUrl, 'PNG', margin + 3, 15, 24, 24, undefined, 'FAST'); 
    } catch { /* */ }
  }

  const textLeft = margin + 42;
  pdf.setTextColor(...BLACK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('PASTA DE FOTOS', textLeft, 22);
  pdf.setFontSize(16);
  pdf.text(scoutName.toUpperCase(), textLeft, 35, { maxWidth: pageW - textLeft - margin });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const dateStr = format(parseLocalDate(dateKey), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  pdf.text(`12º GEMC • ${dateStr} • ${photos.length} fotos`, textLeft, 45);

  // Resume on cover
  pdf.setTextColor(...BLACK);
  pdf.setFontSize(11);
  const coverY = 65;
  pdf.text('Resumo do Álbum', margin, coverY);
  pdf.setFontSize(10);
  pdf.text(`Integrante: ${scoutName}`, margin, coverY + 10);
  pdf.text(`Data da Pasta: ${dateStr}`, margin, coverY + 17);
  pdf.text(`Total de Fotos: ${photos.length}`, margin, coverY + 24);
  pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, coverY + 31);

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const url = signedUrls[p.storage_path];
    if (!url) continue;
    let dataUrl: string;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch { continue; }

    let img: HTMLImageElement;
    try {
      img = await new Promise<HTMLImageElement>((res2, rej2) => {
        const im = new Image();
        im.onload = () => res2(im); im.onerror = rej2; im.src = dataUrl;
      });
    } catch { continue; }

    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2 - 25;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const x = (pageW - w) / 2;
    const y = 35; // Position below header

    pdf.addPage();
    // Header for photo pages
    pdf.setFillColor(...PRIMARY);
    pdf.rect(0, 0, pageW, 25, 'F');
    if (logoDataUrl) {
      try { 
        pdf.setFillColor(...WHITE);
        pdf.circle(margin + 6, 12, 8, 'F');
        pdf.addImage(logoDataUrl, 'PNG', margin + 2, 8, 8, 8, undefined, 'FAST'); 
      } catch { /* */ }
    }
    pdf.setTextColor(...BLACK);
    pdf.setFontSize(11);
    pdf.text(scoutName.toUpperCase(), margin + 18, 14);
    pdf.setFontSize(7);
    pdf.text(`Foto ${i + 1} de ${photos.length} • ${dateStr}`, margin + 18, 20);
    try { pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST'); }
    catch { pdf.addImage(dataUrl, 'PNG', x, y, w, h, undefined, 'FAST'); }
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    pdf.setTextColor(...BLACK);
    pdf.text(
      `Página ${i + 2} • Foto enviada em ${format(new Date(p.created_at), 'dd/MM/yyyy HH:mm')}`,
      pageW / 2, y + h + 10, { align: 'center' },
    );
  }

  if (options.preview) return pdf.output('datauristring');
  pdf.save(`${scoutName.replace(/\s+/g, '_')}_${dateKey}.pdf`);
}
