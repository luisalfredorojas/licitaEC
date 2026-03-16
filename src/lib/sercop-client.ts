import { redis } from "./redis.js";
import type {
  SERCOPSearchParams,
  SERCOPSearchResponse,
  SERCOPRecordResponse,
  OCDSRelease,
} from "../types/ocds.js";

const SERCOP_BASE_URL =
  "https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const CACHE_TTL_SECONDS = 300; // 5 minutos

interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
}

export class SERCOPClient {
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number; maxRetries?: number }) {
    this.baseUrl = options?.baseUrl ?? SERCOP_BASE_URL;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options?.maxRetries ?? MAX_RETRIES;
  }

  async searchProcesses(
    params: SERCOPSearchParams,
    options?: RequestOptions
  ): Promise<SERCOPSearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set("year", String(params.year));
    if (params.page) searchParams.set("page", String(params.page));
    if (params.search) searchParams.set("search", params.search);
    if (params.buyer) searchParams.set("buyer", params.buyer);
    if (params.supplier) searchParams.set("supplier", params.supplier);

    const url = `${this.baseUrl}/search_ocds?${searchParams.toString()}`;
    const data = await this.fetchWithRetry<SERCOPSearchResponse>(url, options);
    return data;
  }

  async getProcessRecord(ocid: string): Promise<OCDSRelease> {
    const cacheKey = `sercop:record:${ocid}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as OCDSRelease;
    }

    const url = `${this.baseUrl}/record?ocid=${encodeURIComponent(ocid)}`;
    const data = await this.fetchWithRetry<SERCOPRecordResponse>(url);

    const record = data.records?.[0];
    const release = record?.compiledRelease ?? record?.releases?.[0];
    if (!release) {
      throw new Error(`No release found for OCID: ${ocid}`);
    }

    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(release));
    return release;
  }

  async fetchBulkData(
    year: number,
    onProgress?: (page: number, totalPages: number, totalProcesses: number) => void
  ): Promise<{ releases: OCDSRelease[]; totalPages: number }> {
    const progressKey = `sercop:bulk:${year}:progress`;
    const allReleases: OCDSRelease[] = [];

    // Recuperar progreso guardado
    const savedProgress = await redis.get(progressKey);
    let startPage = 1;
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress) as { lastPage: number };
      startPage = parsed.lastPage + 1;
    }

    // Primera página para obtener el total
    const firstResponse = await this.searchProcesses({ year, page: startPage });
    const totalPages = firstResponse.meta?.pages ?? 1;
    allReleases.push(...firstResponse.releases);

    onProgress?.(startPage, totalPages, allReleases.length);

    // Guardar progreso
    await redis.setex(progressKey, 86400, JSON.stringify({ lastPage: startPage }));

    for (let page = startPage + 1; page <= totalPages; page++) {
      try {
        const response = await this.searchProcesses({ year, page });
        allReleases.push(...response.releases);

        onProgress?.(page, totalPages, allReleases.length);

        // Guardar progreso en cada página
        await redis.setex(progressKey, 86400, JSON.stringify({ lastPage: page }));
      } catch (error) {
        console.error(`[SERCOPClient] Error en página ${page}/${totalPages}:`, error);
        // Guardar hasta dónde llegamos para poder continuar
        throw error;
      }
    }

    // Limpiar progreso al terminar exitosamente
    await redis.del(progressKey);

    return { releases: allReleases, totalPages };
  }

  private async fetchWithRetry<T>(
    url: string,
    options?: RequestOptions
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const maxRetries = options?.retries ?? this.maxRetries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { signal: controller.signal });
        const duration = Date.now() - startTime;
        console.log(
          `[SERCOPClient] ${response.status} ${url} (${duration}ms, intento ${attempt + 1})`
        );

        if (response.status === 429) {
          // Backoff exponencial para rate limit: min(60s * 2^intento, 300s)
          const waitMs = Math.min(60_000 * Math.pow(2, attempt), 300_000);
          console.warn(`[SERCOPClient] Rate limited (429). Esperando ${waitMs / 1000}s...`);
          await this.sleep(waitMs);
          continue;
        }

        if (response.status >= 500) {
          // Error del servidor: reintentar con espera de 5s
          if (attempt < maxRetries) {
            console.warn(
              `[SERCOPClient] Error ${response.status}. Reintentando en 5s...`
            );
            await this.sleep(5_000);
            continue;
          }
          throw new Error(
            `SERCOP API error ${response.status}: ${await response.text()}`
          );
        }

        if (!response.ok) {
          throw new Error(
            `SERCOP API error ${response.status}: ${await response.text()}`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (lastError.name === "AbortError") {
          lastError = new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
        }

        if (attempt < maxRetries) {
          const waitMs = 5_000;
          console.warn(
            `[SERCOPClient] Error: ${lastError.message}. Reintentando en ${waitMs / 1000}s...`
          );
          await this.sleep(waitMs);
          continue;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError ?? new Error(`Failed to fetch: ${url}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Instancia singleton
export const sercopClient = new SERCOPClient();
