import ExcelJS from 'exceljs';
import { BENEFICIARY_LABELS, EVENT_TYPE_LABELS, FUNDING_LABELS, STATUS_LABELS } from '@/lib/constants';
import type { EventWithRelations } from '@/server/events';

/** Flat, analysis-ready rows — the same shape for CSV and Excel (§35). */
const COLUMNS: Array<{ header: string; key: string; width: number; value: (e: EventWithRelations) => string | number }> = [
  { header: 'Event ID', key: 'eventId', width: 16, value: (e) => e.eventId },
  { header: 'Event Name', key: 'eventName', width: 32, value: (e) => e.eventName },
  { header: 'Date', key: 'date', width: 12, value: (e) => e.eventDate.toISOString().slice(0, 10) },
  { header: 'Start', key: 'start', width: 8, value: (e) => e.startTime ?? '' },
  { header: 'End', key: 'end', width: 8, value: (e) => e.endTime ?? '' },
  { header: 'Avenue', key: 'avenue', width: 22, value: (e) => e.avenue.name },
  { header: 'Type', key: 'type', width: 10, value: (e) => EVENT_TYPE_LABELS[e.eventType] },
  { header: 'Status', key: 'status', width: 18, value: (e) => STATUS_LABELS[e.status] },
  { header: 'Chair', key: 'chair', width: 22, value: (e) => e.chair?.name ?? e.chairNameText ?? '' },
  { header: 'Secretary', key: 'secretary', width: 22, value: (e) => e.secretary?.name ?? '' },
  { header: 'Venue / Platform', key: 'venue', width: 26, value: (e) => e.venue ?? e.platform ?? '' },
  { header: 'City', key: 'city', width: 16, value: (e) => e.city ?? '' },
  { header: 'Project With', key: 'projectWith', width: 26, value: (e) => e.projectWith },
  { header: 'Partner Orgs', key: 'partners', width: 30, value: (e) => e.collaborators.map((c) => c.orgName).join('; ') },
  { header: 'Rotaractors', key: 'rotaractors', width: 12, value: (e) => e.rotaractorsPresent },
  { header: 'Rotarians', key: 'rotarians', width: 12, value: (e) => e.rotariansPresent },
  { header: 'Council', key: 'council', width: 10, value: (e) => e.councilPresent },
  { header: 'Guests', key: 'guests', width: 10, value: (e) => e.guestsPresent },
  { header: 'Total Participants', key: 'participants', width: 18, value: (e) => e.totalParticipants },
  { header: 'Beneficiary Groups', key: 'beneficiaryGroups', width: 30, value: (e) => e.beneficiaries.map((b) => BENEFICIARY_LABELS[b.category]).join('; ') },
  { header: 'Direct Beneficiaries', key: 'direct', width: 18, value: (e) => e.directBeneficiaries },
  { header: 'Indirect Beneficiaries', key: 'indirect', width: 20, value: (e) => e.indirectBeneficiaries },
  { header: 'Total Beneficiaries', key: 'totalBeneficiaries', width: 18, value: (e) => e.totalBeneficiaries },
  { header: 'Cost', key: 'cost', width: 12, value: (e) => Number(e.eventCost) },
  { header: 'Currency', key: 'currency', width: 10, value: (e) => e.currency },
  { header: 'Funding Source', key: 'funding', width: 20, value: (e) => (e.fundingSource ? FUNDING_LABELS[e.fundingSource] : '') },
  { header: 'Sponsor', key: 'sponsor', width: 20, value: (e) => e.sponsorName ?? '' },
  { header: 'Project', key: 'project', width: 22, value: (e) => e.project?.name ?? e.projectName ?? '' },
  { header: 'Phase', key: 'phase', width: 8, value: (e) => e.phaseNumber ?? '' },
  { header: 'Photos', key: 'photos', width: 8, value: (e) => e.photos.length },
  { header: 'Documents', key: 'documents', width: 10, value: (e) => e.documents.length },
  { header: 'Completeness %', key: 'completeness', width: 14, value: (e) => e.completeness },
  { header: 'Drive Folder', key: 'drive', width: 40, value: (e) => e.driveFolder?.folderUrl ?? '' },
  { header: 'Submitted', key: 'submitted', width: 20, value: (e) => e.submittedAt?.toISOString() ?? '' },
  { header: 'Approved', key: 'approved', width: 20, value: (e) => e.approvedAt?.toISOString() ?? '' },
  { header: 'Description', key: 'description', width: 60, value: (e) => (e.description ?? '').replace(/\s+/g, ' ') },
];

function csvCell(value: string | number) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(events: EventWithRelations[]): string {
  const header = COLUMNS.map((c) => csvCell(c.header)).join(',');
  const rows = events.map((e) => COLUMNS.map((c) => csvCell(c.value(e))).join(','));
  return ['﻿' + header, ...rows].join('\n');
}

export async function buildXlsx(events: EventWithRelations[], sheetName = 'Events'): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rotaract Event Reporting CRM';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 30), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCD2A63' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 22;

  for (const event of events) {
    sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.value(event)])));
  }
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
