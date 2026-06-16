"use client";

import { useRef, useState } from "react";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

interface SelectedFile {
  name: string;
  sizeBytes: number;
  validation: ValidationResult;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validate(file: File): ValidationResult {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { valid: false, error: "יש לבחור קובץ בפורמט .xlsx בלבד" };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `גודל הקובץ (${formatSize(file.size)}) חורג מהמותר (${formatSize(MAX_SIZE_BYTES)})`,
    };
  }
  return { valid: true };
}

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedFile | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelected({
      name: file.name,
      sizeBytes: file.size,
      validation: validate(file),
    });
    // Reset input so re-selecting the same file triggers onChange again
    e.target.value = "";
  }

  const isValid = selected?.validation.valid === true;

  return (
    <div className="flex flex-col gap-6">
      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl border-2 border-dashed border-gray-300 px-8 py-14 text-center transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <p className="text-base text-gray-600">לחץ לבחירת קובץ Excel</p>
        <p className="mt-1 text-sm text-gray-400">.xlsx בלבד · עד 20 MB</p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* File details */}
      {selected !== null && (
        <div
          className={`rounded-lg border p-4 ${
            isValid
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <span
              className={`break-all text-sm font-medium ${
                isValid ? "text-green-800" : "text-red-800"
              }`}
            >
              {selected.name}
            </span>
            <span className="shrink-0 text-sm text-gray-500">
              {formatSize(selected.sizeBytes)}
            </span>
          </div>

          {selected.validation.valid ? (
            <p className="mt-2 text-sm text-green-700">הקובץ תקין ומוכן להעלאה</p>
          ) : (
            <p className="mt-2 text-sm text-red-600">{selected.validation.error}</p>
          )}
        </div>
      )}

      {/* Action button — disabled until a valid file is selected */}
      <button
        type="button"
        disabled={!isValid}
        className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        העלאת הקובץ
      </button>
    </div>
  );
}
