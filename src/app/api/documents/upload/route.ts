import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSupabaseServiceClient } from "@/lib/supabase"

import { hasPlan, planError } from "@/lib/plan-guard"
import { SubscriptionPlan } from "@prisma/client"

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "image/jpg",
]

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  const orgId = user.orgId as string
  const plan = user.plan as SubscriptionPlan

  if (!hasPlan(plan, "PROFESSIONAL")) return planError("PROFESSIONAL")

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: "FormData inválido" }, { status: 400 })

  const file = formData.get("file") as File | null
  const ocid = formData.get("ocid") as string | null

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })
  if (!ocid) return NextResponse.json({ error: "OCID requerido" }, { status: 400 })

  // Validations
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 10 MB" }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido. Use PDF, DOCX, XLSX, PNG o JPG." },
      { status: 400 }
    )
  }

  // Find process
  const process = await prisma.procurementProcess.findUnique({
    where: { ocid },
    select: { id: true },
  })
  if (!process) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  // Upload to Supabase Storage
  const supabase = createSupabaseServiceClient()
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${orgId}/${ocid}/${timestamp}_${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from("bid-documents")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error("[Documents] Supabase upload error:", uploadError)
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 })
  }

  // Get public URL (storage is private — we'll use signed URLs for download)
  const { data: urlData } = supabase.storage.from("bid-documents").getPublicUrl(storagePath)

  // Save record in DB
  const doc = await prisma.bidDocument.create({
    data: {
      orgId,
      processId: process.id,
      fileName: file.name,
      fileUrl: storagePath, // store path, not full URL (for signed URL generation)
      fileSize: file.size,
      mimeType: file.type,
    },
  })

  return NextResponse.json({ document: doc, publicUrl: urlData.publicUrl }, { status: 201 })
}
