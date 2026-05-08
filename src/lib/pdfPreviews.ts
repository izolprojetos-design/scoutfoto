import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getGroupLogoDataUrl } from '@/lib/groupLogo';

/**
 * Lightweight sample PDFs that mirror the cover/header of each real report,
 * so the user can verify how the current group logo will appear before
 * generating real reports. Returns a Blob URL (caller must revoke).
 */

const PRIMARY: [number, number, number] = [25, 80, 140];
const MUTED: [number, number, number] = [110, 110, 110];

const SAMPLE = {
  name: 'MARIA EXEMPLO DA SILVA',
  section: 'Tropa Escoteira',
  group: '12º Grupo Escoteiro Monte Caburaí',
  birth: '15/03/2012',
  date: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
};

function footer(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Pré-visualização • ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ScoutFoto`,
    15,
    pageH - 8,
  );
  doc.text('Amostra', pageW - 15, pageH - 8, { align: 'right' });
}

/** Sample of "Perfil do Integrante" cover page. */
export async function buildScoutProfilePreview(): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const logo = await getGroupLogoDataUrl();

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 55, 'F');
  const textLeft = logo ? margin + 30 : margin;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, 12, 25, 25, undefined, 'FAST');
    } catch { /* ignore */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('PERFIL DO INTEGRANTE', textLeft, 22);
  doc.setFontSize(18);
  doc.text(SAMPLE.name, textLeft, 34, { maxWidth: pageW - textLeft - margin });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`${SAMPLE.section} • ${SAMPLE.group}`, textLeft, 47);

  // Sample stats block
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Resumo', margin, 75);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  ['Idade: 13 anos', `Nascimento: ${SAMPLE.birth}`, 'No grupo: 2 anos', 'Ramo atual: Escoteiro', 'Próximo ramo: Sênior em 1 ano']
    .forEach((l, i) => doc.text(l, margin, 83 + i * 5.5));

  autoTable(doc, {
    startY: 120,
    head: [['Nome', 'E-mail', 'Telefone']],
    body: [
      ['João da Silva', 'joao@exemplo.com', '(95) 99999-0000'],
      ['Ana Pereira', 'ana@exemplo.com', '(95) 98888-0000'],
    ],
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin, right: margin },
    theme: 'striped',
  });

  footer(doc);
  return URL.createObjectURL(doc.output('blob'));
}

/** Sample of "Linha do Tempo" page. */
export async function buildTimelinePreview(): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const logo = await getGroupLogoDataUrl();

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 18, 'F');
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 2, 14, 14, undefined, 'FAST'); } catch { /* */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Linha do Tempo', logo ? margin + 18 : margin, 12);

  autoTable(doc, {
    startY: 24,
    head: [['Data', 'Tipo', 'Marco']],
    body: [
      ['10/03/2026', 'Conquista', 'Especialidade de Pioneirismo'],
      ['22/01/2026', 'Aniversário', '13º aniversário'],
      ['05/12/2025', 'Fotos', '8 fotos\ndezembro de 2025'],
      ['14/08/2025', 'Seção', 'Mudança de seção\nLobinho → Escoteiro'],
      ['02/02/2024', 'Ingresso', 'Ingresso no grupo'],
    ],
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

  footer(doc);
  return URL.createObjectURL(doc.output('blob'));
}

/** Sample of "Pasta de Fotos por Data" cover. */
export async function buildPhotoFolderPreview(): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await getGroupLogoDataUrl();

  if (logo) {
    try { doc.addImage(logo, 'PNG', (pageW - 35) / 2, 18, 35, 35, undefined, 'FAST'); } catch { /* */ }
  }
  const coverTop = logo ? 62 : 30;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(SAMPLE.name, pageW / 2, coverTop, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
  doc.text(`Pasta: ${SAMPLE.date}`, pageW / 2, coverTop + 10, { align: 'center' });
  doc.setFontSize(11);
  doc.text(SAMPLE.group, pageW / 2, coverTop + 18, { align: 'center' });
  doc.text('Total de fotos: 24', pageW / 2, coverTop + 26, { align: 'center' });
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW / 2, coverTop + 33, { align: 'center' });

  footer(doc);
  return URL.createObjectURL(doc.output('blob'));
}
