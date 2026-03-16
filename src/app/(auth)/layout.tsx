import Link from "next/link";
import { Shield } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1E40AF] rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-[#1E40AF]">LicitaEC</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">{children}</main>
      <footer className="p-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} LicitaEC · Datos de{" "}
        <a
          href="https://datosabiertos.compraspublicas.gob.ec"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          compraspublicas.gob.ec
        </a>
      </footer>
    </div>
  );
}
