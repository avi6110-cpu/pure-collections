import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold">העלאת דוח</h1>
        <p className="mt-1 mb-8 text-gray-500">בחר קובץ Excel להעלאה למערכת</p>
        <UploadForm />
      </div>
    </main>
  );
}
