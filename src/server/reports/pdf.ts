import { existsSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { readStored } from '@/server/storage/local';
import { getClubSettings, getReportSections, type ReportSections } from '@/server/settings';
import { BENEFICIARY_LABELS, EVENT_TYPE_LABELS, FUNDING_LABELS } from '@/lib/constants';
import { formatDate, formatTime } from '@/lib/utils';
import type { EventWithRelations } from '@/server/events';

/**
 * Server-side PDF generation (§21–§23).
 *
 * The board member never designs anything: this builds a consistent, branded
 * document from the structured data that is already in the database.
 *
 * Fonts: PDFKit's built-in Helvetica covers Latin text only. Clubs whose event
 * titles use Tamil/Devanagari/other scripts should drop a Unicode TTF at
 * public/fonts/report-regular.ttf (+ report-bold.ttf) — it is picked up
 * automatically. See README → "Reports in non-Latin scripts".
 */

const COLORS = {
  brand: '#cd2a63',
  ink: '#161a23',
  muted: '#6b7385',
  line: '#dfe3ea',
  soft: '#f7f8fa',
};

type Doc = InstanceType<typeof PDFDocument>;

function fontPaths() {
  const dir = path.join(process.cwd(), 'public', 'fonts');
  const regular = path.join(dir, 'report-regular.ttf');
  const bold = path.join(dir, 'report-bold.ttf');
  return {
    regular: existsSync(regular) ? regular : null,
    bold: existsSync(bold) ? bold : null,
  };
}

function createDoc(title: string): { doc: Doc; fonts: { regular: string; bold: string } } {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: title, Producer: 'Rotaract Event Reporting CRM' } });
  const custom = fontPaths();
  const fonts = { regular: 'Helvetica', bold: 'Helvetica-Bold' };
  if (custom.regular) {
    doc.registerFont('Body', custom.regular);
    fonts.regular = 'Body';
    doc.registerFont('BodyBold', custom.bold ?? custom.regular);
    fonts.bold = 'BodyBold';
  }
  return { doc, fonts };
}

function collect(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/** PDFKit only embeds JPEG/PNG — everything else is converted first. */
async function toEmbeddable(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer).rotate().resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } catch (error) {
    console.warn('[pdf] skipped an image that could not be converted', error);
    return null;
  }
}

function headerBar(doc: Doc, fonts: { regular: string; bold: string }, club: { clubName: string; riDistrict: string; clubId: string }) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 74).fill(COLORS.brand);
  doc
    .fillColor('#ffffff')
    .font(fonts.bold)
    .fontSize(13)
    .text(club.clubName, 48, 24, { width: doc.page.width - 96 });
  doc
    .font(fonts.regular)
    .fontSize(8.5)
    .fillColor('#ffd9e6')
    .text(
      [club.clubId && `Club ID ${club.clubId}`, club.riDistrict && `RI District ${club.riDistrict}`].filter(Boolean).join('   •   '),
      48,
      44,
    );
  doc.restore();
  doc.y = 100;
}

function footer(doc: Doc, fonts: { regular: string }, label: string) {
  // Writing inside the bottom margin would make PDFKit start a new page, so the
  // margin is lifted for this one line and restored immediately after.
  const bottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc
    .font(fonts.regular)
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(label, 48, doc.page.height - 34, { width: doc.page.width - 96, align: 'left', lineBreak: false });
  doc.page.margins.bottom = bottomMargin;
}

function sectionTitle(doc: Doc, fonts: { bold: string }, text: string) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.moveDown(0.6);
  doc.x = 48;
  doc.font(fonts.bold).fontSize(11).fillColor(COLORS.brand).text(text.toUpperCase(), 48, doc.y, { characterSpacing: 0.6 });
  doc.moveTo(48, doc.y + 3).lineTo(doc.page.width - 48, doc.y + 3).lineWidth(0.8).strokeColor(COLORS.line).stroke();
  doc.moveDown(0.6);
}

function keyValueRows(doc: Doc, fonts: { regular: string; bold: string }, rows: Array<[string, string]>) {
  const labelWidth = 150;
  const valueWidth = doc.page.width - 96 - labelWidth;
  for (const [label, value] of rows) {
    if (doc.y > doc.page.height - 90) doc.addPage();
    const y = doc.y;
    doc.font(fonts.bold).fontSize(9.5).fillColor(COLORS.muted).text(label, 48, y, { width: labelWidth });
    const labelHeight = doc.y - y;
    doc.font(fonts.regular).fontSize(10.5).fillColor(COLORS.ink).text(value || '—', 48 + labelWidth, y, { width: valueWidth });
    doc.y = y + Math.max(labelHeight, doc.y - y) + 4;
  }
  doc.x = 48; // helpers must never leave the cursor in a column
}

function statBoxes(doc: Doc, fonts: { regular: string; bold: string }, stats: Array<{ label: string; value: string }>) {
  const gap = 10;
  const perRow = Math.min(4, stats.length || 1);
  const width = (doc.page.width - 96 - gap * (perRow - 1)) / perRow;
  let x = 48;
  const y = doc.y;
  stats.forEach((stat, i) => {
    if (i > 0 && i % perRow === 0) return;
    doc.roundedRect(x, y, width, 52, 8).fillAndStroke(COLORS.soft, COLORS.line);
    doc.font(fonts.bold).fontSize(15).fillColor(COLORS.ink).text(stat.value, x + 10, y + 10, { width: width - 20 });
    doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted).text(stat.label.toUpperCase(), x + 10, y + 32, { width: width - 20 });
    x += width + gap;
  });
  doc.y = y + 66;
  doc.x = 48;
}

async function photoGrid(doc: Doc, fonts: { regular: string }, photos: Array<{ storagePath: string; caption: string | null }>, max = 12) {
  const gap = 12;
  const cols = 2;
  const width = (doc.page.width - 96 - gap) / cols;
  const height = width * 0.68;
  let col = 0;
  let y = doc.y;

  for (const photo of photos.slice(0, max)) {
    let buffer: Buffer | null = null;
    try {
      buffer = await toEmbeddable(await readStored(photo.storagePath));
    } catch {
      buffer = null;
    }
    if (!buffer) continue;

    if (y + height + 30 > doc.page.height - 60) {
      doc.addPage();
      y = doc.y;
      col = 0;
    }
    const x = 48 + col * (width + gap);
    doc.image(buffer, x, y, { fit: [width, height], align: 'center', valign: 'center' });
    doc.roundedRect(x, y, width, height, 6).lineWidth(0.7).strokeColor(COLORS.line).stroke();
    if (photo.caption) {
      doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted).text(photo.caption, x, y + height + 4, { width, height: 20, ellipsis: true });
    }
    col += 1;
    if (col === cols) {
      col = 0;
      y += height + 30;
    }
  }
  doc.y = col === 0 ? y : y + height + 30;
  doc.x = 48;
}

function eventRows(event: EventWithRelations, sections: ReportSections, currency: string): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const push = (on: boolean, label: string, value: string) => {
    if (on) rows.push([label, value]);
  };
  push(sections.chair !== false, 'Event Chair', event.chair?.name ?? event.chairNameText ?? '—');
  push(sections.chair !== false && Boolean(event.secretary), 'Event Secretary', event.secretary?.name ?? '—');
  push(sections.date !== false, 'Event Date', formatDate(event.eventDate));
  push(sections.date !== false, 'Event Time', [formatTime(event.startTime), event.endTime ? `– ${formatTime(event.endTime)}` : ''].join(' ').trim());
  push(sections.avenue !== false, 'Avenue of Service', event.avenue.name);
  push(true, 'Event Type', EVENT_TYPE_LABELS[event.eventType]);
  push(sections.cost !== false, 'Event Cost', `${currency} ${Number(event.eventCost).toLocaleString('en-IN')}`);
  push(
    sections.cost !== false && Boolean(event.fundingSource),
    'Funding Source',
    event.fundingSource ? FUNDING_LABELS[event.fundingSource] : '—',
  );
  push(
    sections.beneficiaries !== false,
    'Event Beneficiaries',
    event.beneficiaries.length ? event.beneficiaries.map((b) => BENEFICIARY_LABELS[b.category]).join(', ') : '—',
  );
  push(sections.participation !== false, 'Council Presence', String(event.councilPresent));
  push(sections.participation !== false, 'Rotarians Presence', String(event.rotariansPresent));
  push(sections.participation !== false, 'Rotaractors Presence', String(event.rotaractorsPresent));
  push(sections.participation !== false && event.guestsPresent > 0, 'Guests Presence', String(event.guestsPresent));
  push(sections.collaboration !== false, 'Project With', event.projectWith || 'SELF');
  push(
    sections.venue !== false,
    'Venue / Platform',
    event.eventType === 'ONLINE' ? (event.platform ?? '—') : [event.venue, event.city].filter(Boolean).join(', ') || '—',
  );
  if (event.projectName || event.project) {
    push(true, 'Project', `${event.project?.name ?? event.projectName}${event.phaseNumber ? ` — Phase ${event.phaseNumber}` : ''}`);
  }
  return rows;
}

export async function buildEventReportPdf(eventId: string): Promise<{ buffer: Buffer; title: string }> {
  const event = (await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      avenue: true,
      chair: { select: { id: true, name: true, image: true, email: true } },
      secretary: { select: { id: true, name: true, image: true } },
      director: { select: { id: true, name: true, image: true } },
      createdBy: { select: { id: true, name: true, image: true, email: true } },
      project: true,
      beneficiaries: true,
      collaborators: true,
      photos: { orderBy: { sortOrder: 'asc' } },
      documents: { orderBy: { uploadedAt: 'asc' } },
      socialLinks: true,
      driveFolder: true,
      reports: { orderBy: { createdAt: 'desc' } },
    },
  })) as EventWithRelations;

  const club = await getClubSettings();
  const sections = await getReportSections();
  const { doc, fonts } = createDoc(`${event.eventId} — ${event.eventName}`);
  const done = collect(doc);

  // --- Cover -------------------------------------------------------------
  headerBar(doc, fonts, club);
  doc.moveDown(3);
  doc.font(fonts.regular).fontSize(10).fillColor(COLORS.muted).text(club.rotarySponsor ? `Sponsored by ${club.rotarySponsor}` : '', { align: 'center' });
  doc.moveDown(3);
  doc.font(fonts.bold).fontSize(13).fillColor(COLORS.brand).text(event.avenue.name.toUpperCase(), { align: 'center', characterSpacing: 1.2 });
  doc.moveDown(0.5);
  doc.font(fonts.bold).fontSize(30).fillColor(COLORS.ink).text(event.eventName, { align: 'center' });
  doc.moveDown(0.6);
  doc.font(fonts.regular).fontSize(12).fillColor(COLORS.muted).text(
    `${formatDate(event.eventDate)}${event.startTime ? ` · ${formatTime(event.startTime)}` : ''}`,
    { align: 'center' },
  );
  doc.moveDown(0.3);
  doc.font(fonts.regular).fontSize(10).fillColor(COLORS.muted).text(event.eventId, { align: 'center' });

  doc.moveDown(3);
  statBoxes(doc, fonts, [
    { label: 'Participants', value: String(event.totalParticipants) },
    { label: 'Beneficiaries', value: String(event.totalBeneficiaries) },
    { label: 'Cost', value: `${club.currency} ${Number(event.eventCost).toLocaleString('en-IN')}` },
    { label: 'Photos', value: String(event.photos.length) },
  ]);

  if (event.photos[0]) {
    const cover = await toEmbeddable(await readStored(event.photos[0].storagePath)).catch(() => null);
    if (cover) {
      const w = doc.page.width - 96;
      doc.image(cover, 48, doc.y, { fit: [w, 240], align: 'center' });
    }
  }
  footer(doc, fonts, `${club.clubName} · ${club.currentYear} · Generated ${formatDate(new Date())}`);

  // --- Details -----------------------------------------------------------
  doc.addPage();
  headerBar(doc, fonts, club);
  sectionTitle(doc, fonts, 'Event details');
  keyValueRows(doc, fonts, eventRows(event, sections, club.currency));

  if (sections.collaboration !== false && event.collaborators.length) {
    sectionTitle(doc, fonts, 'Collaboration');
    keyValueRows(
      doc,
      fonts,
      event.collaborators.map((c) => [c.orgName, [c.contactName, c.contactEmail, c.contactPhone].filter(Boolean).join(' · ') || '—'] as [string, string]),
    );
  }

  if (sections.participation !== false) {
    sectionTitle(doc, fonts, 'Participation & reach');
    statBoxes(doc, fonts, [
      { label: 'Rotaractors', value: String(event.rotaractorsPresent) },
      { label: 'Rotarians', value: String(event.rotariansPresent) },
      { label: 'Council', value: String(event.councilPresent) },
      { label: 'Guests', value: String(event.guestsPresent) },
    ]);
    statBoxes(doc, fonts, [
      { label: 'Total participants', value: String(event.totalParticipants) },
      { label: 'Direct beneficiaries', value: String(event.directBeneficiaries) },
      { label: 'Indirect beneficiaries', value: String(event.indirectBeneficiaries) },
      { label: 'Total beneficiaries', value: String(event.totalBeneficiaries) },
    ]);
  }

  if (sections.description !== false && event.description) {
    sectionTitle(doc, fonts, 'Description');
    doc
      .font(fonts.regular)
      .fontSize(10.5)
      .fillColor(COLORS.ink)
      .text(event.description, 48, doc.y, { width: doc.page.width - 96, align: 'justify', lineGap: 2.5 });
  }

  if (sections.impact !== false && (event.objective || event.accomplished || event.impact || event.specialOutcome)) {
    sectionTitle(doc, fonts, 'Objective & impact');
    keyValueRows(doc, fonts, [
      ['Objective', event.objective ?? '—'],
      ['What was accomplished', event.accomplished ?? '—'],
      ['Impact', event.impact ?? '—'],
      ['Special outcome', event.specialOutcome ?? '—'],
    ]);
  }

  if (sections.socialMedia && event.socialLinks.length) {
    sectionTitle(doc, fonts, 'Published online');
    keyValueRows(doc, fonts, event.socialLinks.map((s) => [s.platform, s.url] as [string, string]));
  }

  if (sections.internalNotes && event.internalNotes) {
    sectionTitle(doc, fonts, 'Internal notes');
    doc.font(fonts.regular).fontSize(10).fillColor(COLORS.ink).text(event.internalNotes, 48, doc.y, { width: doc.page.width - 96 });
  }

  footer(doc, fonts, `${event.eventId} · ${club.clubName}`);

  // --- Photographs -------------------------------------------------------
  if (sections.photos !== false && event.photos.length) {
    doc.addPage();
    headerBar(doc, fonts, club);
    sectionTitle(doc, fonts, 'Event photographs');
    await photoGrid(doc, fonts, event.photos.map((p) => ({ storagePath: p.storagePath, caption: p.caption })));
    footer(doc, fonts, `${event.eventId} · ${club.clubName}`);
  }

  doc.end();
  return { buffer: await done, title: `${event.eventId} — ${event.eventName}` };
}

export type PeriodReportParams = {
  kind: 'MONTHLY' | 'AVENUE' | 'ANNUAL';
  from: Date;
  to: Date;
  avenueId?: string | null;
  label: string;
  includePhotos?: boolean;
};

export async function buildPeriodReportPdf(params: PeriodReportParams): Promise<{ buffer: Buffer; title: string; count: number }> {
  const club = await getClubSettings();
  const sections = await getReportSections();

  const events = (await prisma.event.findMany({
    where: {
      deletedAt: null,
      status: 'APPROVED',
      eventDate: { gte: params.from, lt: params.to },
      ...(params.avenueId ? { avenueId: params.avenueId } : {}),
    },
    orderBy: { eventDate: 'asc' },
    include: {
      avenue: true,
      chair: { select: { id: true, name: true, image: true, email: true } },
      secretary: { select: { id: true, name: true, image: true } },
      director: { select: { id: true, name: true, image: true } },
      createdBy: { select: { id: true, name: true, image: true, email: true } },
      project: true,
      beneficiaries: true,
      collaborators: true,
      photos: { orderBy: { sortOrder: 'asc' }, take: 4 },
      documents: true,
      socialLinks: true,
      driveFolder: true,
      reports: true,
    },
  })) as EventWithRelations[];

  const totals = events.reduce(
    (acc, e) => ({
      participants: acc.participants + e.totalParticipants,
      beneficiaries: acc.beneficiaries + e.totalBeneficiaries,
      cost: acc.cost + Number(e.eventCost),
    }),
    { participants: 0, beneficiaries: 0, cost: 0 },
  );

  const { doc, fonts } = createDoc(params.label);
  const done = collect(doc);

  headerBar(doc, fonts, club);
  doc.moveDown(2);
  doc.font(fonts.bold).fontSize(12).fillColor(COLORS.brand).text(
    params.kind === 'ANNUAL' ? 'ANNUAL REPORT' : params.kind === 'AVENUE' ? 'AVENUE REPORT' : 'MONTHLY REPORT',
    { align: 'center', characterSpacing: 1.2 },
  );
  doc.moveDown(0.4);
  doc.font(fonts.bold).fontSize(26).fillColor(COLORS.ink).text(params.label, { align: 'center' });
  doc.moveDown(0.3);
  doc.font(fonts.regular).fontSize(10).fillColor(COLORS.muted).text(
    `${formatDate(params.from)} – ${formatDate(new Date(params.to.getTime() - 86400000))}`,
    { align: 'center' },
  );

  doc.moveDown(2);
  statBoxes(doc, fonts, [
    { label: 'Total events', value: String(events.length) },
    { label: 'Participants', value: totals.participants.toLocaleString('en-IN') },
    { label: 'Beneficiaries', value: totals.beneficiaries.toLocaleString('en-IN') },
    { label: 'Expenditure', value: `${club.currency} ${totals.cost.toLocaleString('en-IN')}` },
  ]);

  // Avenue breakdown
  const byAvenue = new Map<string, { name: string; events: number; participants: number; beneficiaries: number; cost: number }>();
  for (const e of events) {
    const entry = byAvenue.get(e.avenueId) ?? { name: e.avenue.name, events: 0, participants: 0, beneficiaries: 0, cost: 0 };
    entry.events += 1;
    entry.participants += e.totalParticipants;
    entry.beneficiaries += e.totalBeneficiaries;
    entry.cost += Number(e.eventCost);
    byAvenue.set(e.avenueId, entry);
  }

  if (byAvenue.size > 1) {
    sectionTitle(doc, fonts, 'Events by avenue of service');
    keyValueRows(
      doc,
      fonts,
      [...byAvenue.values()].map(
        (a) =>
          [a.name, `${a.events} events · ${a.participants} participants · ${a.beneficiaries} beneficiaries · ${club.currency} ${a.cost.toLocaleString('en-IN')}`] as [string, string],
      ),
    );
  }

  const collaborations = events.filter((e) => e.isCollaboration);
  if (collaborations.length) {
    sectionTitle(doc, fonts, 'Collaborations');
    keyValueRows(
      doc,
      fonts,
      collaborations.map((e) => [e.eventName, e.collaborators.map((c) => c.orgName).join(', ') || e.projectWith] as [string, string]),
    );
  }

  const projects = new Map<string, number>();
  for (const e of events) {
    const name = e.project?.name ?? e.projectName;
    if (name) projects.set(name, (projects.get(name) ?? 0) + 1);
  }
  if (projects.size) {
    sectionTitle(doc, fonts, 'Projects');
    keyValueRows(doc, fonts, [...projects.entries()].map(([name, count]) => [name, `${count} phase${count === 1 ? '' : 's'} this period`] as [string, string]));
  }

  footer(doc, fonts, `${club.clubName} · ${club.currentYear}`);

  // Per-event summaries
  for (const event of events) {
    doc.addPage();
    headerBar(doc, fonts, club);
    doc.font(fonts.bold).fontSize(16).fillColor(COLORS.ink).text(event.eventName);
    doc.font(fonts.regular).fontSize(9).fillColor(COLORS.muted).text(`${event.eventId} · ${event.avenue.name} · ${formatDate(event.eventDate)}`);
    doc.moveDown(0.8);
    keyValueRows(doc, fonts, eventRows(event, sections, club.currency));
    if (sections.description !== false && event.description) {
      sectionTitle(doc, fonts, 'Description');
      doc
        .font(fonts.regular)
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text(event.description, 48, doc.y, { width: doc.page.width - 96, align: 'justify', lineGap: 2 });
    }
    if (params.includePhotos !== false && event.photos.length) {
      sectionTitle(doc, fonts, 'Photographs');
      await photoGrid(doc, fonts, event.photos.map((p) => ({ storagePath: p.storagePath, caption: p.caption })), 4);
    }
    footer(doc, fonts, `${event.eventId} · ${club.clubName}`);
  }

  doc.end();
  return { buffer: await done, title: params.label, count: events.length };
}
