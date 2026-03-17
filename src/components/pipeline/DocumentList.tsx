"use client"

import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, Trash2, Download, FileText, FileImage, FileSpreadsheet } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface BidDocument {
  id: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  uploadedAt: string
}

interface Props {
  trackingId: string
  processId: string
  ocid: string
}

function fileIcon(mimeType: string | null) {
  if (!mimeType) return <FileText className="h-4 w-4 text-gray-400" />
  if (mimeType.includes("image")) return <FileImage className="h-4 w-4 text-blue-400" />
  if (mimeType.includes("spreadsheet") || mimeType.includes("xlsx"))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />
  return <FileText className="h-4 w-4 text-red-400" />
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentList({ processId, ocid }: Props) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: docs = [], isLoading } = useQuery<BidDocument[]>({
    queryKey: ["documents", processId],
    queryFn: async () => {
      const res = await fetch(`/api/documents?processId=${processId}`)
      if (!res.ok) throw new Error("Error cargando documentos")
      const data = await res.json()
      return data.documents
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", processId] }),
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("ocid", ocid)

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al subir")

      queryClient.invalidateQueries({ queryKey: ["documents", processId] })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleDownload(doc: BidDocument) {
    const res = await fetch(`/api/documents/${doc.id}`)
    const data = await res.json()
    if (data.url) window.open(data.url, "_blank")
  }

  if (isLoading) return <p className="text-xs text-gray-400">Cargando documentos...</p>

  return (
    <div className="space-y-2">
      {docs.length === 0 ? (
        <p className="text-xs text-gray-400">No hay documentos adjuntos.</p>
      ) : (
        <ul className="space-y-1">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5 text-xs"
            >
              {fileIcon(doc.mimeType)}
              <span className="flex-1 truncate font-medium">{doc.fileName}</span>
              <span className="text-gray-400 flex-shrink-0">{formatBytes(doc.fileSize)}</span>
              <span className="text-gray-400 flex-shrink-0">
                {formatDate(new Date(doc.uploadedAt))}
              </span>
              <button
                onClick={() => handleDownload(doc)}
                className="text-gray-400 hover:text-blue-600"
                title="Descargar"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => deleteMutation.mutate(doc.id)}
                className="text-gray-400 hover:text-red-600"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1" />
          )}
          Subir documento
        </Button>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, PNG, JPG — máx 10 MB</p>
      </div>
    </div>
  )
}
