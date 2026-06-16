import type { RivhitRow } from "@/lib/parseRivhit";

const COLUMNS: { key: keyof RivhitRow; label: string; numeric?: boolean }[] = [
  { key: "customerName",     label: "שם לקוח" },
  { key: "documentType",     label: "מסמך" },
  { key: "documentNumber",   label: "מס' מסמך",       numeric: true },
  { key: "reference",        label: "אסמכתא" },
  { key: "documentDate",     label: "תאריך מסמך" },
  { key: "dueDate",          label: "תאריך פרעון" },
  { key: "documentTotal",    label: "סה\"כ למסמך",    numeric: true },
  { key: "paidAmount",       label: "שולם / נסגר",    numeric: true },
  { key: "remainingBalance", label: "יתרה לתשלום",    numeric: true },
];

const numFmt = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCell(row: RivhitRow, col: (typeof COLUMNS)[number]): string {
  const v = row[col.key];
  if (col.numeric && typeof v === "number") return numFmt.format(v);
  return String(v);
}

interface ImportTableProps {
  rows: RivhitRow[];
}

export function ImportTable({ rows }: ImportTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">לא נמצאו שורות בקובץ</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        נמצאו <span className="font-semibold text-gray-800">{rows.length}</span> רשומות
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap border-b border-gray-200 px-4 py-3 font-semibold text-gray-700 ${
                    col.numeric ? "text-left" : "text-right"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-2 text-gray-700 ${
                      col.numeric ? "text-left tabular-nums" : "text-right"
                    }`}
                  >
                    {formatCell(row, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
