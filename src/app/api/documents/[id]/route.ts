import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSupabaseServiceClient } from "@/lib/supabase"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const { id } = await params

  const doc = await prisma.bidDocument.findFirst({
    where: { id, orgId },
  })
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 })

  // Generate signed URL (1 hour expiry)
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.storage
    .from("bid-documents")
    .createSignedUrl(doc.fileUrl, 60 * 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Error generando URL de descarga" }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl, fileName: doc.fileName })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const { id } = await params

  const doc = await prisma.bidDocument.findFirst({ where: { id, orgId } })
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 })

  // Delete from Supabase Storage
  const supabase = createSupabaseServiceClient()
  const { error: storageError } = await supabase.storage
    .from("bid-documents")
    .remove([doc.fileUrl])

  if (storageError) {
    console.error("[Documents] Error eliminando de Storage:", storageError)
    // Continue to delete DB record even if storage fails
  }

  await prisma.bidDocument.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
