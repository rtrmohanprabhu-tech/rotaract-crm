import { describe, expect, it } from 'vitest';
import {
  EVENT_SUBFOLDERS,
  documentFileName,
  eventDrivePath,
  eventFolderName,
  eventIdFor,
  monthFolderName,
  parseEventId,
  periodReportFileName,
  photoFileName,
  reportFileName,
  rotaractYearOf,
  sanitizeName,
} from '@/lib/naming';

describe('event ids', () => {
  it('formats sequential ids', () => {
    expect(eventIdFor(2026, 1)).toBe('EVT-2026-0001');
    expect(eventIdFor(2026, 42)).toBe('EVT-2026-0042');
    expect(eventIdFor(2026, 1234)).toBe('EVT-2026-1234');
  });

  it('round-trips', () => {
    expect(parseEventId('EVT-2026-0007')).toEqual({ year: 2026, sequence: 7 });
    expect(parseEventId('nonsense')).toBeNull();
  });
});

describe('sanitising names', () => {
  it('removes characters Drive dislikes', () => {
    expect(sanitizeName('Care2Cook / Phase #1')).toBe('Care2Cook_Phase_1');
    expect(sanitizeName('a\\b:c*d?e"f<g>h|i')).toBe('a_b_c_d_e_f_g_h_i');
  });

  it('keeps non-Latin titles intact', () => {
    expect(sanitizeName('மழலைக் கரங்கள் Phase 6')).toBe('மழலைக்_கரங்கள்_Phase_6');
  });

  it('never returns an empty name', () => {
    expect(sanitizeName('')).toBe('Untitled');
    expect(sanitizeName('///')).toBe('Untitled');
  });

  it('bounds the length', () => {
    expect(sanitizeName('a'.repeat(200), 20).length).toBeLessThanOrEqual(20);
  });
});

describe('Rotaract year', () => {
  it('starts on 1 July', () => {
    expect(rotaractYearOf(new Date('2026-07-01T00:00:00Z'))).toBe('2026-27');
    expect(rotaractYearOf(new Date('2026-06-30T00:00:00Z'))).toBe('2025-26');
    expect(rotaractYearOf(new Date('2026-01-30T00:00:00Z'))).toBe('2025-26');
  });
});

describe('drive layout', () => {
  it('builds Year / Avenue / Month / Event', () => {
    const path = eventDrivePath({
      eventDate: new Date('2026-01-30T00:00:00Z'),
      avenueName: 'Community Service',
      eventId: 'EVT-2026-0001',
      eventName: 'Care2Cook',
      yearLabel: '2026-27',
    });
    expect(path).toEqual(['2026-27', 'Community Service', 'January 2026', 'EVT-2026-0001_Care2Cook']);
  });

  it('falls back to the Rotaract year of the event date', () => {
    const path = eventDrivePath({
      eventDate: new Date('2026-08-09T00:00:00Z'),
      avenueName: 'Sports',
      eventId: 'EVT-2026-0008',
      eventName: 'Cricket',
    });
    expect(path[0]).toBe('2026-27');
    expect(path[2]).toBe(monthFolderName(new Date('2026-08-09T00:00:00Z')));
  });

  it('has the six numbered subfolders in order', () => {
    expect(EVENT_SUBFOLDERS.map((f) => f.name)).toEqual([
      '01_Event_Photos',
      '02_Event_Poster',
      '03_Documents',
      '04_Financials',
      '05_Social_Media',
      '06_Generated_Report',
    ]);
  });

  it('names the event folder with the id first', () => {
    expect(eventFolderName('EVT-2026-0001', 'Care2Cook')).toBe('EVT-2026-0001_Care2Cook');
  });
});

describe('file names', () => {
  it('numbers photos and keeps the extension', () => {
    expect(photoFileName('EVT-2026-0001', 'Care2Cook', 1, 'IMG_2931.JPG')).toBe('EVT-2026-0001_Care2Cook_Photo_01.jpg');
    expect(photoFileName('EVT-2026-0001', 'Care2Cook', 12, 'shot.png')).toBe('EVT-2026-0001_Care2Cook_Photo_12.png');
  });

  it('labels documents by category', () => {
    expect(documentFileName('EVT-2026-0001', 'Care2Cook', 'BILL', 1, 'scan.pdf')).toBe('EVT-2026-0001_Care2Cook_Bill_01.pdf');
    expect(documentFileName('EVT-2026-0001', 'Care2Cook', 'POSTER', 0, 'poster.png')).toBe('EVT-2026-0001_Care2Cook_Poster.png');
  });

  it('names generated reports predictably', () => {
    expect(reportFileName('EVT-2026-0001', 'Care2Cook')).toBe('EVT-2026-0001_Care2Cook_Report.pdf');
    expect(periodReportFileName('MONTHLY', 'January 2026')).toBe('January_2026_Monthly_Report.pdf');
  });
});
