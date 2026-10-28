import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { LevelCode } from "@prisma/client";
import { levelLabel } from "./levels.js";

export type TransferCertificateData = {
  certificateNumber: string;
  issuedDate: Date;
  school: {
    name: string;
    code: string;
    address?: string | null;
  };
  student: {
    fullName: string;
    permanentId: string;
    secondaryPermanentId?: string | null;
    gender?: string | null;
    dateOfBirth?: string | Date | null;
    nationality?: string | null;
    guardianName?: string | null;
    relationship?: string | null;
  };
  enrollment: {
    classLevel: LevelCode;
    sectionName?: string | null;
    academicYearName: string;
    studentNumber?: string | null;
    rollNumber?: number | null;
    admissionDate?: Date | null;
  };
  destinationSchoolName?: string | null;
  reason?: string | null;
};

export type TranscriptTermResult = {
  term: "TERM_1" | "TERM_2";
  label: string;
  status: "final" | "provisional" | "unavailable";
  average: number | null;
  obtained: number;
  possible: number;
  subjects: Array<{
    subject: string;
    maxMarks: number;
    marks: number | null;
    isAbsent: boolean;
    pending: boolean;
    percentage: number | null;
  }>;
};

export type TranscriptYearData = {
  academicYearName: string;
  classLevel: LevelCode;
  sectionName?: string | null;
  status: string;
  overallAverage: number | null;
  terms: TranscriptTermResult[];
};

export type StudentTranscriptData = {
  school: {
    name: string;
    code: string;
    address?: string | null;
  };
  student: {
    fullName: string;
    permanentId: string;
    gender?: string | null;
    dateOfBirth?: string | Date | null;
  };
  certificateNumber: string;
  generatedDate: Date;
  years: TranscriptYearData[];
};

const FONT_PRIMARY = "Calibri";
const FONT_DISPLAY = "Cambria";

const COLORS = {
  navyDark: "0F172A",
  navyPrimary: "1E3A8A",
  slateDark: "1E293B",
  slateText: "334155",
  slateMuted: "64748B",
  slateLight: "94A3B8",
  borderLight: "CBD5E1",
  borderSubtle: "E2E8F0",
  bgHeader: "1E293B",
  bgSubheader: "F1F5F9",
  bgZebra: "F8FAFC",
  bgAccent: "EFF6FF",
  white: "FFFFFF",
  emerald: "047857",
  amber: "B45309",
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
};

function formatDate(val?: Date | string | null): string {
  if (!val) return "N/A";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatStanding(pct: number | null): string {
  if (pct == null) return "—";
  if (pct >= 90) return "A+ (Excellent)";
  if (pct >= 80) return "A (Very Good)";
  if (pct >= 70) return "B (Good)";
  if (pct >= 60) return "C (Satisfactory)";
  if (pct >= 50) return "D (Pass)";
  return "F (Needs Improvement)";
}

/**
 * Builds the institutional letterhead and document title banner shared across official transfer documents.
 */
function buildInstitutionalHeader(
  school: { name: string; code: string; address?: string | null },
  documentTitle: string,
  documentSubtitle: string,
): (Paragraph | Table)[] {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 24, color: COLORS.navyPrimary },
                bottom: { style: BorderStyle.DOUBLE, size: 8, color: COLORS.navyPrimary },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              margins: { top: 180, bottom: 160, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: school.name.toUpperCase(),
                      bold: true,
                      font: FONT_DISPLAY,
                      size: 34,
                      color: COLORS.navyDark,
                    }),
                  ],
                  spacing: { after: 60 },
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `INSTITUTION CODE: ${school.code.toUpperCase()}`,
                      bold: true,
                      font: FONT_PRIMARY,
                      size: 18,
                      color: COLORS.navyPrimary,
                    }),
                    ...(school.address
                      ? [
                          new TextRun({
                            text: `   •   ${school.address}`,
                            font: FONT_PRIMARY,
                            size: 18,
                            color: COLORS.slateMuted,
                          }),
                        ]
                      : []),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 140, after: 40 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLORS.bgSubheader },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                left: { style: BorderStyle.SINGLE, size: 18, color: COLORS.navyPrimary },
                right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
              },
              margins: { top: 120, bottom: 120, left: 180, right: 180 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: documentTitle,
                      bold: true,
                      font: FONT_DISPLAY,
                      size: 26,
                      color: COLORS.navyDark,
                    }),
                  ],
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: documentSubtitle,
                      italics: true,
                      font: FONT_PRIMARY,
                      size: 18,
                      color: COLORS.slateMuted,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 140, after: 60 } }),
  ];
}

/**
 * Builds a section divider row for structured tables.
 */
function sectionHeaderRow(title: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        shading: { type: ShadingType.CLEAR, fill: COLORS.bgHeader },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
          left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
          right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
        },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: title.toUpperCase(),
                bold: true,
                font: FONT_PRIMARY,
                size: 19,
                color: COLORS.white,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Builds a zebra-striped key-value row with crisp cell borders and padding.
 */
function fieldRow(label: string, value: string, index: number, highlightValue = false): TableRow {
  const fill = index % 2 === 0 ? COLORS.white : COLORS.bgZebra;
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 38, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 85, bottom: 85, left: 140, right: 120 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
          left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
          right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                font: FONT_PRIMARY,
                size: 20,
                color: COLORS.slateText,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 62, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 85, bottom: 85, left: 140, right: 140 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
          left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
          right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: value,
                bold: highlightValue,
                font: FONT_PRIMARY,
                size: 20,
                color: highlightValue ? COLORS.navyPrimary : COLORS.navyDark,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Builds the three-column signature and official seal block.
 */
function buildSignatureBlock(leftRole: string, sealLabel: string, rightRole: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.BOTTOM,
            margins: { top: 100, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "____________________________",
                    font: FONT_PRIMARY,
                    size: 18,
                    color: COLORS.slateLight,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: leftRole,
                    bold: true,
                    font: FONT_PRIMARY,
                    size: 20,
                    color: COLORS.slateDark,
                  }),
                ],
                spacing: { before: 60, after: 30 },
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Signature & Date",
                    font: FONT_PRIMARY,
                    size: 16,
                    color: COLORS.slateMuted,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140, left: 100, right: 100 },
            borders: {
              top: { style: BorderStyle.DASHED, size: 4, color: COLORS.borderLight },
              bottom: { style: BorderStyle.DASHED, size: 4, color: COLORS.borderLight },
              left: { style: BorderStyle.DASHED, size: 4, color: COLORS.borderLight },
              right: { style: BorderStyle.DASHED, size: 4, color: COLORS.borderLight },
            },
            shading: { type: ShadingType.CLEAR, fill: COLORS.bgZebra },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: sealLabel,
                    bold: true,
                    font: FONT_PRIMARY,
                    size: 17,
                    color: COLORS.slateLight,
                  }),
                ],
                spacing: { before: 80, after: 80 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.BOTTOM,
            margins: { top: 100, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "____________________________",
                    font: FONT_PRIMARY,
                    size: 18,
                    color: COLORS.slateLight,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: rightRole,
                    bold: true,
                    font: FONT_PRIMARY,
                    size: 20,
                    color: COLORS.slateDark,
                  }),
                ],
                spacing: { before: 60, after: 30 },
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Authorized Signature & Date",
                    font: FONT_PRIMARY,
                    size: 16,
                    color: COLORS.slateMuted,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Builds the official document footer with reference number and page numbering.
 */
function buildDocumentFooter(schoolName: string, certificateNumber: string, issuedDate: Date): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight, space: 6 },
        },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${schoolName}  |  Ref: ${certificateNumber}  |  Issued: ${formatDate(issuedDate)}  |  Page `,
            font: FONT_PRIMARY,
            size: 16,
            color: COLORS.slateMuted,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: FONT_PRIMARY,
            size: 16,
            color: COLORS.slateMuted,
          }),
          new TextRun({
            text: " of ",
            font: FONT_PRIMARY,
            size: 16,
            color: COLORS.slateMuted,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: FONT_PRIMARY,
            size: 16,
            color: COLORS.slateMuted,
          }),
        ],
      }),
    ],
  });
}

/**
 * Builds an official, clean, editable Transfer Certificate DOCX Buffer.
 */
export async function generateTransferCertificateDocx(data: TransferCertificateData): Promise<Buffer> {
  const studentIdDisplay = data.student.secondaryPermanentId
    ? `${data.student.permanentId} / ${data.student.secondaryPermanentId}`
    : data.student.permanentId;

  const classLevelLabel = levelLabel(data.enrollment.classLevel);
  const classDisplay = data.enrollment.sectionName
    ? `${classLevelLabel} — Section ${data.enrollment.sectionName}`
    : classLevelLabel;

  let rowIdx = 0;
  const rows: TableRow[] = [
    sectionHeaderRow("I. Student Identification Particulars"),
    fieldRow("1. Full Name of Student", data.student.fullName, rowIdx++, true),
    fieldRow("2. Permanent Student ID", studentIdDisplay, rowIdx++),
    fieldRow("3. Gender", data.student.gender || "N/A", rowIdx++),
    fieldRow("4. Date of Birth", formatDate(data.student.dateOfBirth), rowIdx++),
    ...(data.student.nationality
      ? [fieldRow("5. Nationality", data.student.nationality, rowIdx++)]
      : []),
    ...(data.student.guardianName
      ? [fieldRow(`6. Parent / Legal Guardian (${data.student.relationship || "Guardian"})`, data.student.guardianName, rowIdx++)]
      : []),

    sectionHeaderRow("II. Enrollment & Academic Standing"),
    fieldRow("7. Academic Year", data.enrollment.academicYearName, rowIdx++),
    fieldRow("8. Current Class / Grade Level", classDisplay, rowIdx++, true),
    ...(data.enrollment.studentNumber
      ? [fieldRow("9. Admission / Student Number", data.enrollment.studentNumber, rowIdx++)]
      : []),
    ...(data.enrollment.rollNumber != null
      ? [fieldRow("10. Class Roll Number", String(data.enrollment.rollNumber), rowIdx++)]
      : []),
    ...(data.enrollment.admissionDate
      ? [fieldRow("11. Date of Enrollment", formatDate(data.enrollment.admissionDate), rowIdx++)]
      : []),

    sectionHeaderRow("III. Transfer & Institutional Clearance Details"),
    fieldRow("12. Transfer Certificate Number", data.certificateNumber, rowIdx++, true),
    fieldRow("13. Destination Institution", data.destinationSchoolName?.trim() || "To Whom It May Concern / Not Specified", rowIdx++),
    fieldRow("14. Reason for Leaving", data.reason?.trim() || "Parent Request / Normal Transfer", rowIdx++),
    fieldRow("15. General Conduct & Character", "Good / Satisfactory", rowIdx++),
    fieldRow("16. Date of Official Issue", formatDate(data.issuedDate), rowIdx++),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1080, right: 1080 },
          },
        },
        footers: {
          default: buildDocumentFooter(data.school.name, data.certificateNumber, data.issuedDate),
        },
        children: [
          ...buildInstitutionalHeader(
            data.school,
            "OFFICIAL TRANSFER CERTIFICATE",
            "Issued under the Authority of the Office of the School Registrar",
          ),

          // Metadata Reference Bar
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: COLORS.bgAccent },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                      right: { style: BorderStyle.NONE },
                    },
                    margins: { top: 90, bottom: 90, left: 140, right: 140 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "CERTIFICATE NO: ",
                            bold: true,
                            font: FONT_PRIMARY,
                            size: 19,
                            color: COLORS.slateText,
                          }),
                          new TextRun({
                            text: data.certificateNumber,
                            bold: true,
                            font: FONT_PRIMARY,
                            size: 21,
                            color: COLORS.navyPrimary,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: COLORS.bgAccent },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    },
                    margins: { top: 90, bottom: 90, left: 140, right: 140 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: "DATE OF ISSUE: ",
                            bold: true,
                            font: FONT_PRIMARY,
                            size: 19,
                            color: COLORS.slateText,
                          }),
                          new TextRun({
                            text: formatDate(data.issuedDate),
                            bold: true,
                            font: FONT_PRIMARY,
                            size: 20,
                            color: COLORS.navyDark,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 140, after: 60 } }),

          // Main Categorized Particulars Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),

          new Paragraph({ spacing: { before: 180, after: 80 } }),

          // Certification & Clearance Attestation Callout Box
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: COLORS.bgZebra },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      left: { style: BorderStyle.SINGLE, size: 18, color: COLORS.navyPrimary },
                      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                    },
                    margins: { top: 120, bottom: 120, left: 180, right: 180 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "OFFICIAL ATTESTATION & CLEARANCE: ",
                            bold: true,
                            font: FONT_PRIMARY,
                            size: 19,
                            color: COLORS.navyDark,
                          }),
                          new TextRun({
                            text: "This is to certify that the above-named student was bonafide enrolled at this institution and is departing upon official application. All institutional records and academic clearances have been verified as of the date of issue.",
                            italics: true,
                            font: FONT_PRIMARY,
                            size: 19,
                            color: COLORS.slateText,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 320, after: 120 } }),

          // Signatures & Official Seal Block
          buildSignatureBlock("Class Teacher / Registrar", "[ OFFICIAL SCHOOL SEAL ]", "Principal / Headmaster"),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Helper to create a compact label + value cell pair for the Student Transcript profile summary card.
 */
function profileSummaryRow(
  leftLabel: string,
  leftValue: string,
  rightLabel: string,
  rightValue: string,
  highlightRight = false,
): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 18, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: COLORS.bgSubheader },
        margins: { top: 80, bottom: 80, left: 120, right: 100 },
        verticalAlign: VerticalAlign.CENTER,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
          right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: leftLabel,
                bold: true,
                font: FONT_PRIMARY,
                size: 19,
                color: COLORS.slateText,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 32, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: COLORS.white },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: leftValue,
                bold: true,
                font: FONT_PRIMARY,
                size: 20,
                color: COLORS.navyDark,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 18, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: COLORS.bgSubheader },
        margins: { top: 80, bottom: 80, left: 120, right: 100 },
        verticalAlign: VerticalAlign.CENTER,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: rightLabel,
                bold: true,
                font: FONT_PRIMARY,
                size: 19,
                color: COLORS.slateText,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 32, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: COLORS.white },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
          right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: rightValue,
                bold: highlightRight,
                font: FONT_PRIMARY,
                size: 20,
                color: highlightRight ? COLORS.navyPrimary : COLORS.navyDark,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Builds an official, clean, editable Student Academic Transcript DOCX Buffer.
 */
export async function generateStudentTranscriptDocx(data: StudentTranscriptData): Promise<Buffer> {
  const sectionsChildren: (Paragraph | Table)[] = [
    ...buildInstitutionalHeader(
      data.school,
      "OFFICIAL ACADEMIC TRANSCRIPT",
      "Comprehensive Record of Published Term & Annual Examinations",
    ),

    // Student Profile Summary Card
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        profileSummaryRow("Student Name", data.student.fullName, "Transfer Ref No.", data.certificateNumber, true),
        profileSummaryRow("Permanent ID", data.student.permanentId, "Date Issued", formatDate(data.generatedDate)),
        profileSummaryRow(
          "Gender",
          data.student.gender || "N/A",
          "Date of Birth",
          formatDate(data.student.dateOfBirth),
        ),
      ],
    }),

    new Paragraph({ spacing: { before: 160, after: 100 } }),
  ];

  // Academic Records by Academic Year
  if (data.years.length === 0) {
    sectionsChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: COLORS.bgZebra },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                  left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                  right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                },
                margins: { top: 240, bottom: 240, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "No official or published examination records found for this student at this institution.",
                        italics: true,
                        font: FONT_PRIMARY,
                        size: 21,
                        color: COLORS.slateMuted,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  } else {
    for (const year of data.years) {
      const classLabel = levelLabel(year.classLevel);
      const sectionSuffix = year.sectionName ? ` (Section ${year.sectionName})` : "";
      const cumulativeBadge =
        year.overallAverage != null
          ? `Cumulative Average: ${year.overallAverage}%  •  ${formatStanding(year.overallAverage)}`
          : `Enrollment Status: ${year.status}`;

      // Academic Year Banner Header
      sectionsChildren.push(
        new Paragraph({ spacing: { before: 160, after: 40 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 58, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgHeader },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 100, bottom: 100, left: 150, right: 120 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
                    left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
                    right: { style: BorderStyle.NONE },
                  },
                  children: [
                    new Paragraph({
                      heading: HeadingLevel.HEADING_2,
                      children: [
                        new TextRun({
                          text: `ACADEMIC YEAR: ${year.academicYearName}  —  ${classLabel}${sectionSuffix}`,
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 21,
                          color: COLORS.white,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 42, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgHeader },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 100, bottom: 100, left: 120, right: 150 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.bgHeader },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: cumulativeBadge,
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: "E2E8F0",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );

      // Render Terms
      for (const term of year.terms) {
        const statusColor =
          term.status === "final"
            ? COLORS.emerald
            : term.status === "provisional"
              ? COLORS.amber
              : COLORS.slateMuted;

        sectionsChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${term.label} Examination`,
                bold: true,
                font: FONT_PRIMARY,
                size: 20,
                color: COLORS.slateDark,
              }),
              new TextRun({
                text: `   [ STATUS: ${term.status.toUpperCase()} ]`,
                bold: true,
                font: FONT_PRIMARY,
                size: 17,
                color: statusColor,
              }),
            ],
            spacing: { before: 140, after: 80 },
          }),
        );

        if (term.subjects.length === 0) {
          sectionsChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "No published subject marks recorded for this examination term.",
                  italics: true,
                  font: FONT_PRIMARY,
                  size: 19,
                  color: COLORS.slateMuted,
                }),
              ],
              spacing: { after: 120 },
            }),
          );
        } else {
          // Subject Marks Table
          const tableRows: TableRow[] = [
            new TableRow({
              tableHeader: true,
              children: [
                new TableCell({
                  width: { size: 36, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgSubheader },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.slateMuted },
                    left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "Subject Name",
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyDark,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 15, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgSubheader },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.slateMuted },
                    left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Max Marks",
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyDark,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 16, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgSubheader },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.slateMuted },
                    left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Obtained",
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyDark,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 14, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgSubheader },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.slateMuted },
                    left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Percentage",
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyDark,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 19, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgSubheader },
                  margins: { top: 80, bottom: 80, left: 100, right: 120 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.slateMuted },
                    left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Standing",
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyDark,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ];

          for (let idx = 0; idx < term.subjects.length; idx++) {
            const s = term.subjects[idx]!;
            const rowFill = idx % 2 === 0 ? COLORS.white : COLORS.bgZebra;

            let obtainedText = "—";
            if (s.isAbsent) {
              obtainedText = "Absent (0)";
            } else if (s.marks != null) {
              obtainedText = String(s.marks);
            } else if (s.pending) {
              obtainedText = "Pending";
            }

            const pctText = s.percentage != null ? `${s.percentage}%` : "—";
            const standingText = s.isAbsent ? "Absent" : s.pending ? "Pending" : formatStanding(s.percentage);

            tableRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: rowFill },
                    margins: { top: 70, bottom: 70, left: 120, right: 120 },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: s.subject,
                            font: FONT_PRIMARY,
                            size: 19,
                            color: COLORS.navyDark,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: rowFill },
                    margins: { top: 70, bottom: 70, left: 100, right: 100 },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: String(s.maxMarks),
                            font: FONT_PRIMARY,
                            size: 19,
                            color: COLORS.slateText,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: rowFill },
                    margins: { top: 70, bottom: 70, left: 100, right: 100 },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: obtainedText,
                            bold: s.marks != null,
                            font: FONT_PRIMARY,
                            size: 19,
                            color: s.isAbsent ? COLORS.amber : COLORS.navyDark,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: rowFill },
                    margins: { top: 70, bottom: 70, left: 100, right: 100 },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: pctText,
                            font: FONT_PRIMARY,
                            size: 19,
                            color: COLORS.slateText,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: rowFill },
                    margins: { top: 70, bottom: 70, left: 100, right: 120 },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: standingText,
                            font: FONT_PRIMARY,
                            size: 18,
                            color: COLORS.slateMuted,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            );
          }

          // Summary Row for Term
          tableRows.push(
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgAccent },
                  margins: { top: 85, bottom: 85, left: 120, right: 120 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "Term Total & Average",
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyPrimary,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgAccent },
                  margins: { top: 85, bottom: 85, left: 100, right: 100 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: String(term.possible),
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyDark,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgAccent },
                  margins: { top: 85, bottom: 85, left: 100, right: 100 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: String(term.obtained),
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyDark,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgAccent },
                  margins: { top: 85, bottom: 85, left: 100, right: 100 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: term.average != null ? `${term.average}%` : "N/A",
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 19,
                          color: COLORS.navyPrimary,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: COLORS.bgAccent },
                  margins: { top: 85, bottom: 85, left: 100, right: 120 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navyPrimary },
                    left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
                    right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderLight },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: formatStanding(term.average),
                          bold: true,
                          font: FONT_PRIMARY,
                          size: 18,
                          color: COLORS.navyPrimary,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          );

          sectionsChildren.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            }),
            new Paragraph({ spacing: { after: 120 } }),
          );
        }
      }
    }
  }

  // Grading Scale & Attestation Box
  sectionsChildren.push(
    new Paragraph({ spacing: { before: 180, after: 60 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLORS.bgZebra },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
                left: { style: BorderStyle.SINGLE, size: 18, color: COLORS.navyPrimary },
                right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderSubtle },
              },
              margins: { top: 110, bottom: 110, left: 160, right: 160 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "GRADING KEY: ",
                      bold: true,
                      font: FONT_PRIMARY,
                      size: 18,
                      color: COLORS.navyDark,
                    }),
                    new TextRun({
                      text: "A+ (90–100% Excellent)  •  A (80–89% Very Good)  •  B (70–79% Good)  •  C (60–69% Satisfactory)  •  D (50–59% Pass)  •  F (<50% Needs Improvement)",
                      font: FONT_PRIMARY,
                      size: 18,
                      color: COLORS.slateText,
                    }),
                  ],
                  spacing: { after: 60 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "OFFICIAL CERTIFICATION: ",
                      bold: true,
                      font: FONT_PRIMARY,
                      size: 18,
                      color: COLORS.navyDark,
                    }),
                    new TextRun({
                      text: "Certified as a true and accurate extract of the official examination records maintained by the institution.",
                      italics: true,
                      font: FONT_PRIMARY,
                      size: 18,
                      color: COLORS.slateText,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 300, after: 100 } }),
    buildSignatureBlock("Examinations Officer", "[ INSTITUTIONAL SEAL ]", "Principal / School Registrar"),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1080, right: 1080 },
          },
        },
        footers: {
          default: buildDocumentFooter(data.school.name, data.certificateNumber, data.generatedDate),
        },
        children: sectionsChildren,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
