/**
 * Script de carga histórica de procesos SERCOP.
 *
 * Uso:
 *   bun run scripts/seed-historical.ts --year=2025
 *   bun run scripts/seed-historical.ts --year=2024
 *
 * Idempotente: puede ejecutarse múltiples veces sin duplicar datos.
 * Guarda progreso en Redis para poder continuar si falla.
 */

import { prisma } from "../src/lib/prisma.js";
import { sercopClient } from "../src/lib/sercop-client.js";
import { transformRelease, transformAwards } from "../src/lib/ocds-transformer.js";
import type { OCDSRelease } from "../src/types/ocds.js";

async function main() {
  const yearArg = process.argv.find((arg) => arg.startsWith("--year="));
  const year = yearArg ? parseInt(yearArg.split("=")[1]!, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2010 || year > 2030) {
    console.error("Año inválido. Uso: bun run scripts/seed-historical.ts --year=2025");
    process.exit(1);
  }

  console.log(`\n🔄 Iniciando carga histórica para el año ${year}...\n`);

  const startTime = Date.now();
  let totalProcessed = 0;
  let newRecords = 0;
  let updatedRecords = 0;
  let errors = 0;

  // Crear SyncLog
  const syncLog = await prisma.syncLog.create({
    data: { status: "RUNNING", year },
  });

  try {
    const { releases, totalPages } = await sercopClient.fetchBulkData(
      year,
      (page, total, processCount) => {
        const pct = Math.round((page / total) * 100);
        process.stdout.write(
          `\r  Página ${page}/${total} — ${processCount.toLocaleString("es-EC")} procesos descargados (${pct}%)`
        );
      }
    );

    console.log(`\n\n  Descarga completa. Procesando ${releases.length.toLocaleString("es-EC")} releases...\n`);

    for (let i = 0; i < releases.length; i++) {
      const release = releases[i]!;

      try {
        const data = transformRelease(release);

        const existing = await prisma.procurementProcess.findUnique({
          where: { ocid: release.ocid },
          select: { id: true },
        });

        if (!existing) {
          const created = await prisma.procurementProcess.create({ data });

          const awards = transformAwards(release, created.id);
          if (awards.length > 0) {
            await prisma.procurementAward.createMany({ data: awards });
          }

          newRecords++;
        } else {
          await prisma.procurementProcess.update({
            where: { ocid: release.ocid },
            data: { ...data, ocid: undefined },
          });

          const awards = transformAwards(release, existing.id);
          for (const award of awards) {
            await prisma.procurementAward.upsert({
              where: {
                processId_awardId: {
                  processId: existing.id,
                  awardId: award.awardId,
                },
              },
              create: award,
              update: award,
            });
          }

          updatedRecords++;
        }

        totalProcessed++;

        if (totalProcessed % 100 === 0) {
          const pct = Math.round((totalProcessed / releases.length) * 100);
          process.stdout.write(
            `\r  Procesando: ${totalProcessed.toLocaleString("es-EC")}/${releases.length.toLocaleString("es-EC")} (${pct}%)`
          );
        }
      } catch (error) {
        errors++;
        if (errors <= 10) {
          console.error(`\n  Error en ${release.ocid}:`, error);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: errors > 0 ? "PARTIAL" : "COMPLETED",
        completedAt: new Date(),
        totalProcessed,
        newRecords,
        updatedRecords,
        errors,
        year,
      },
    });

    console.log(`\n\n✅ Carga histórica ${year} completada en ${duration}s`);
    console.log(`   Total procesados: ${totalProcessed.toLocaleString("es-EC")}`);
    console.log(`   Nuevos:           ${newRecords.toLocaleString("es-EC")}`);
    console.log(`   Actualizados:     ${updatedRecords.toLocaleString("es-EC")}`);
    console.log(`   Errores:          ${errors.toLocaleString("es-EC")}\n`);
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        totalProcessed,
        newRecords,
        updatedRecords,
        errors,
        errorDetails: { message: String(error) },
      },
    });

    console.error(`\n\n❌ Error fatal durante la carga:`, error);
    console.log(`   Se procesaron ${totalProcessed} registros antes del error.`);
    console.log(`   Puedes volver a ejecutar el script — continuará desde donde quedó.\n`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
