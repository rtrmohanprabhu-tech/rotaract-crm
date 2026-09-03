# Report fonts

PDFKit's built-in Helvetica covers Latin characters only. If your club's event names use Tamil,
Devanagari, Sinhala, Arabic or any other non-Latin script, drop a Unicode TrueType font here:

    report-regular.ttf
    report-bold.ttf

They are picked up automatically the next time a report is generated (see
`src/server/reports/pdf.ts` → `fontPaths`). Noto Sans / Noto Sans Tamil work well and are
licensed under the SIL Open Font License.

Nothing else needs to change — the database always stores the original text correctly; this only
affects PDF rendering.
