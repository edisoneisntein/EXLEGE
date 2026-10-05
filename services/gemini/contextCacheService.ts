import type { Attachment } from '../../types';

const DEFAULT_TTL_MINUTES = 60;
const DEFAULT_MAX_DIRECT_CHARS = 25_000;
const SNIPPET_LENGTH = 600;
const SUMMARY_LENGTH = 1_000;

// Umbral documentado para decidir conveniencia de persistencia en caché nativo de infraestructura
const MIN_TOKENS_FOR_NATIVE_CACHE = 32_768;
const TOKENS_PER_WORD = 1.35;

export type DeliveryStrategy = 'DIRECT_INJECTION' | 'NATIVE_SERVER_CACHE';

export interface FolioEntry {
    fileName: string;
    snippet: string;
    fullText?: string;
    index: number;
}

export interface CachedCaseContext {
    cacheId: string;
    caseTitle: string;
    primaryDocumentSummary: string;
    fullCombinedText: string;
    totalWordCount: number;
    estimatedTokens: number;
    folioIndex: Map<string, FolioEntry>;
    timestamp: number;
    ttlMinutes: number;
    deliveryStrategy: DeliveryStrategy;
    nativeCacheThresholdReached: boolean;
}

export interface RelevantFolio {
    fileName: string;
    excerpt: string;
    matchScore: number;
    folioKey?: string;
}

export interface DocumentFingerprint {
    name: string;
    size: number;
    textLength: number;
}

/**
 * Gestor de contexto centralizado para expedientes legales.
 *
 * Responsabilidades:
 * - Consolidar acervo documental probatorio y procesal.
 * - Mantener un índice de folios con capacidad de búsqueda profunda en texto completo.
 * - Reutilizar contextos mediante caché local determinista en memoria.
 * - Estimar volumen contextual de manera eficiente (conteo de palabras por streaming/iteración).
 * - Discriminar estrategias de inyección y recuperación de fragmentos relevantes.
 */
class ContextCacheService {
    private readonly cacheMap = new Map<string, CachedCaseContext>();

    /**
     * Genera una clave determinista para el conjunto documental mediante huellas estructurales
     */
    private generateContextHash(
        primaryDoc: Attachment,
        evidenceFiles: readonly Attachment[] = []
    ): string {
        const fingerprints: DocumentFingerprint[] = [
            this.getFingerprint(primaryDoc),
            ...evidenceFiles.map(file => this.getFingerprint(file))
        ];

        const serialized = JSON.stringify(fingerprints);
        return `case-ctx-${this.hashString(serialized)}`;
    }

    private getFingerprint(file: Attachment): DocumentFingerprint {
        return {
            name: file.name,
            size: file.size ?? 0,
            textLength: (file.translatedText ?? file.extractedText ?? '').length
        };
    }

    /**
     * Hash rápido determinista de 32 bits con multiplicación imul(31, hash)
     */
    private hashString(value: string): string {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = Math.imul(31, hash) + value.charCodeAt(i);
        }
        return (hash >>> 0).toString(36);
    }

    /**
     * Obtiene el texto preferido del documento (traducido si existe, de lo contrario extraído)
     */
    private getDocumentText(file: Attachment): string {
        return file.translatedText?.trim() || file.extractedText?.trim() || '';
    }

    /**
     * Normaliza nombres de archivos para utilizarlos como claves estables de folio
     */
    private sanitizeFileName(name: string): string {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 100);
    }

    /**
     * Cuenta palabras de manera iterativa sin instanciar arreglos en memoria (cero Garbage Collection innecesario)
     */
    private countWords(text: string): number {
        let count = 0;
        let inWord = false;

        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            // Espacios, tabulaciones (\t), saltos de línea (\n, \r)
            const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13;

            if (!isWhitespace && !inWord) {
                inWord = true;
                count++;
            } else if (isWhitespace && inWord) {
                inWord = false;
            }
        }

        return count;
    }

    /**
     * Construye el contexto documental consolidado e indexa los folios
     */
    private buildContext(
        primaryDoc: Attachment,
        evidenceFiles: readonly Attachment[],
        cacheId: string
    ): CachedCaseContext {
        const folioIndex = new Map<string, FolioEntry>();
        const combinedParts: string[] = [];

        const primaryText = this.getDocumentText(primaryDoc);

        combinedParts.push(
            `=== DOCUMENTO PRINCIPAL: ${primaryDoc.name} ===\n`,
            primaryText,
            '\n'
        );

        folioIndex.set('DOC_PRINCIPAL', {
            fileName: primaryDoc.name,
            snippet: primaryText.slice(0, SNIPPET_LENGTH),
            fullText: primaryText,
            index: 0
        });

        evidenceFiles.forEach((file, index) => {
            const text = this.getDocumentText(file);
            const folioNumber = index + 1;
            const folioKey = `FOLIO_${folioNumber}_${this.sanitizeFileName(file.name)}`;

            combinedParts.push(
                `=== ANEXO PROBATORIO [${folioNumber}]: ${file.name} ===\n`,
                text,
                '\n'
            );

            folioIndex.set(folioKey, {
                fileName: file.name,
                snippet: text.slice(0, SNIPPET_LENGTH),
                fullText: text,
                index: folioNumber
            });
        });

        const fullCombinedText = combinedParts.join('\n');
        const totalWordCount = this.countWords(fullCombinedText);
        const estimatedTokens = Math.ceil(totalWordCount * TOKENS_PER_WORD);

        const nativeCacheThresholdReached = estimatedTokens >= MIN_TOKENS_FOR_NATIVE_CACHE;
        const deliveryStrategy: DeliveryStrategy = nativeCacheThresholdReached
            ? 'NATIVE_SERVER_CACHE'
            : 'DIRECT_INJECTION';

        return {
            cacheId,
            caseTitle: this.removeExtension(primaryDoc.name),
            primaryDocumentSummary: primaryText.slice(0, SUMMARY_LENGTH),
            fullCombinedText,
            totalWordCount,
            estimatedTokens,
            folioIndex,
            timestamp: Date.now(),
            ttlMinutes: DEFAULT_TTL_MINUTES,
            deliveryStrategy,
            nativeCacheThresholdReached
        };
    }

    private removeExtension(fileName: string): string {
        return fileName.replace(/\.[^/.]+$/, '');
    }

    /**
     * Comprueba si el contexto aún no ha alcanzado su tiempo de expiración
     */
    private isValid(context: CachedCaseContext): boolean {
        return Date.now() - context.timestamp < context.ttlMinutes * 60_000;
    }

    /**
     * Crea o recupera un contexto existente
     */
    public createOrGetContext(
        primaryDoc: Attachment,
        evidenceFiles: readonly Attachment[] = []
    ): CachedCaseContext {
        const cacheId = this.generateContextHash(primaryDoc, evidenceFiles);
        const existing = this.cacheMap.get(cacheId);

        if (existing) {
            if (this.isValid(existing)) {
                return existing;
            }
            this.cacheMap.delete(cacheId);
        }

        const context = this.buildContext(primaryDoc, evidenceFiles, cacheId);
        this.cacheMap.set(cacheId, context);
        return context;
    }

    /**
     * Devuelve el contexto preparado para el prompt del modelo
     */
    public formatPromptContext(
        context: CachedCaseContext,
        maxDirectChars: number = DEFAULT_MAX_DIRECT_CHARS
    ): {
        contextText: string;
        strategy: string;
    } {
        const safeMaxChars = Math.max(0, maxDirectChars);

        if (context.deliveryStrategy === 'DIRECT_INJECTION') {
            const truncated = context.fullCombinedText.length > safeMaxChars;
            return {
                contextText: truncated
                    ? `${context.fullCombinedText.slice(0, safeMaxChars)}\n\n` +
                      `[...Texto indexado en memoria resumido (${context.totalWordCount} palabras totales)...]`
                    : context.fullCombinedText,
                strategy: 'DIRECT_INJECTION (Sub-32k tokens)'
            };
        }

        return {
            contextText: context.fullCombinedText.slice(0, safeMaxChars),
            strategy: `NATIVE_SERVER_CACHE (~${context.estimatedTokens} tokens - Hash: ${context.cacheId})`
        };
    }

    /**
     * Recupera un contexto por su identificador único
     */
    public getContext(cacheId: string): CachedCaseContext | undefined {
        const context = this.cacheMap.get(cacheId);
        if (!context) return undefined;

        if (!this.isValid(context)) {
            this.cacheMap.delete(cacheId);
            return undefined;
        }

        return context;
    }

    /**
     * Busca folios relacionados con palabras clave mediante búsqueda profunda (deep-folio matching)
     * - Normaliza keywords y elimina duplicados y cadenas vacías.
     * - Busca tanto en el snippet inicial como en el texto íntegro del anexo.
     * - Extrae la ventana contextual exacta donde ocurrió la coincidencia en lugar de quedarse ciego tras 500 caracteres.
     */
    public queryRelevantFolios(
        cacheId: string,
        queryKeywords: readonly string[]
    ): RelevantFolio[] {
        const context = this.getContext(cacheId);
        if (!context || queryKeywords.length === 0) {
            return [];
        }

        const keywords = [
            ...new Set(
                queryKeywords
                    .map(k => (k || '').trim().toLowerCase())
                    .filter(Boolean)
            )
        ];

        if (keywords.length === 0) {
            return [];
        }

        const results: RelevantFolio[] = [];

        for (const [folioKey, entry] of context.folioIndex) {
            const sourceText = entry.fullText || entry.snippet;
            const lowerSource = sourceText.toLowerCase();

            let matchScore = 0;
            let bestMatchIndex = -1;

            for (const keyword of keywords) {
                const idx = lowerSource.indexOf(keyword);
                if (idx !== -1) {
                    matchScore++;
                    if (bestMatchIndex === -1 || idx < bestMatchIndex) {
                        bestMatchIndex = idx;
                    }
                }
            }

            if (matchScore > 0) {
                // Si la coincidencia ocurrió más allá de los primeros 500 caracteres,
                // extraemos una ventana contextual centrada en el hallazgo (+/- 200 caracteres)
                let excerpt = entry.snippet;
                if (bestMatchIndex > SNIPPET_LENGTH && sourceText.length > SNIPPET_LENGTH) {
                    const startWindow = Math.max(0, bestMatchIndex - 120);
                    const endWindow = Math.min(sourceText.length, bestMatchIndex + 250);
                    excerpt = `[...] ${sourceText.slice(startWindow, endWindow)} [...]`;
                }

                results.push({
                    fileName: entry.fileName,
                    excerpt,
                    matchScore,
                    folioKey
                });
            }
        }

        return results.sort(
            (a, b) => b.matchScore - a.matchScore || (a.folioKey || '').localeCompare(b.folioKey || '')
        );
    }

    /**
     * Elimina todos los contextos que hayan excedido su tiempo de vida
     */
    public purgeExpired(): void {
        const now = Date.now();
        for (const [cacheId, context] of this.cacheMap) {
            if (now - context.timestamp >= context.ttlMinutes * 60_000) {
                this.cacheMap.delete(cacheId);
            }
        }
    }

    /**
     * Limpia completamente la memoria de caché
     */
    public clear(): void {
        this.cacheMap.clear();
    }

    /**
     * Retorna el número de contextos actualmente en memoria
     */
    public get size(): number {
        return this.cacheMap.size;
    }
}

export const contextCacheService = new ContextCacheService();
