/**
 * Deterministic, filesystem-safe naming for event IDs, Drive folders and files
 * (§13–§15). Pure functions — unit tested in tests/naming.test.ts.
 */

/** Strips anything that upsets Drive/OS file names but keeps readable text. */
export function sanitizeName(input: string, maxLength = 60): string {
  const cleaned = (input || 'Untitled')
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, ' ')
    // strip ASCII control characters
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Non-latin names (e.g. Tamil event titles) are kept as-is; only the length
  // is bounded, so "மழலைக் கரங்கள் Phase 6" survives intact.
  const trimmed = cleaned.slice(0, maxLength).trim();
  return (trimmed || 'Untitled').replace(/\s/g, '_');
}

export function extensionOf(fileName: string, fallback = ''): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(fileName ?? '');
  return m ? `.${m[1].toLowerCase()}` : fallback;
}

export function eventIdFor(year: number, sequence: number): string {
  return `EVT-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parseEventId(eventId: string): { year: number; sequence: number } | null {
  const m = /^EVT-(\d{4})-(\d{4,})$/.exec(eventId.trim().toUpperCase());
  if (!m) return null;
  return { year: Number(m[1]), sequence: Number(m[2]) };
}

/** "2026-27" from a date, Rotaract year starting 1 July. */
export function rotaractYearOf(date: Date): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function monthFolderName(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function eventFolderName(eventId: string, eventName: string): string {
  return `${eventId}_${sanitizeName(eventName, 60)}`;
}

/**
 * 2026-27 / Community Service / January 2026 / EVT-2026-0001_Care2Cook
 */
export function eventDrivePath(params: {
  eventDate: Date;
  avenueName: string;
  eventId: string;
  eventName: string;
  yearLabel?: string;
}): string[] {
  const year = params.yearLabel ?? rotaractYearOf(params.eventDate);
  return [
    year,
    sanitizeName(params.avenueName, 40).replace(/_/g, ' '),
    monthFolderName(params.eventDate),
    eventFolderName(params.eventId, params.eventName),
  ];
}

export const EVENT_SUBFOLDERS = [
  { key: 'photos', name: '01_Event_Photos' },
  { key: 'poster', name: '02_Event_Poster' },
  { key: 'documents', name: '03_Documents' },
  { key: 'financials', name: '04_Financials' },
  { key: 'social', name: '05_Social_Media' },
  { key: 'report', name: '06_Generated_Report' },
] as const;

export type EventSubfolderKey = (typeof EVENT_SUBFOLDERS)[number]['key'];

/** EVT-2026-0001_Care2Cook_Photo_01.jpg */
export function photoFileName(eventId: string, eventName: string, index: number, originalName: string): string {
  const ext = extensionOf(originalName, '.jpg');
  return `${eventId}_${sanitizeName(eventName, 40)}_Photo_${String(index).padStart(2, '0')}${ext}`;
}

/** EVT-2026-0001_Care2Cook_Bill_01.pdf */
export function documentFileName(
  eventId: string,
  eventName: string,
  category: string,
  index: number,
  originalName: string,
): string {
  const ext = extensionOf(originalName, '.pdf');
  const label = sanitizeName(
    category
      .toLowerCase()
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(''),
    30,
  );
  const suffix = index > 0 ? `_${String(index).padStart(2, '0')}` : '';
  return `${eventId}_${sanitizeName(eventName, 40)}_${label}${suffix}${ext}`;
}

/** EVT-2026-0001_Care2Cook_Report.pdf */
export function reportFileName(eventId: string, eventName: string): string {
  return `${eventId}_${sanitizeName(eventName, 40)}_Report.pdf`;
}

export function periodReportFileName(kind: 'MONTHLY' | 'AVENUE' | 'ANNUAL', label: string): string {
  return `${sanitizeName(label, 60)}_${kind.charAt(0) + kind.slice(1).toLowerCase()}_Report.pdf`;
}
