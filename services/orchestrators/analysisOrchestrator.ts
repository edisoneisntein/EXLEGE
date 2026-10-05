import type {
    IntegralAnalysisResponse,
    GroundingSource,
    AnalysisReport,
    CriticalPoint,
    CaseDocumentType,
    AnalysisProgress,
    FracturePointResponseItem,
    JurisprudentialShieldingResponseItem,
    EvidentiaryInconsistencyResponseItem,
    TimelineEvent,
    Attachment
} from '../../types';
import * as Prompts from '../promptManager';
import {
    generateContentWithRetry,
    performWebSearch,
    parseJsonResponse,
    extractTimelineEvents
} from '../geminiService';
import { supervisorAgent, SupervisorDecision } from '../gemini/supervisorAgent';
import { contextCacheService } from '../gemini/contextCacheService';

const MODEL_FAST = 'gemini-3.5-flash';
const MAX_CRITICAL_POINT_PAGES = 3;
const BATCH_CONCURRENCY_LIMIT = 3;
const WEB_SEARCH_CONCURRENCY_LIMIT = 2;

// ============================================================================
// 1. INFRAESTRUCTURA DE CONCURRENCIA Y PROCESAMIENTO POR LOTES
// ============================================================================

/**
 * Ejecutor con límite estricto de concurrencia para evitar saturación de la API
 * y prevenir 'rate limits' no controlados.
 */
export async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    if (items.length === 0) return [];
    const limit = Math.max(1, Math.min(concurrency, items.length));
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    async function workerLoop(): Promise<void> {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) {
                return;
            }
            results[index] = await worker(items[index], index);
        }
    }

    const workers = Array.from({ length: limit }, () => workerLoop());
    await Promise.all(workers);
    return results;
}

export interface BatchResult<T> {
    success: boolean;
    data: T[];
    error?: string;
    batchNumber: number;
}

export interface BatchProcessOptions<TInput, TOutput> {
    batchSize: number;
    concurrency: number;
    phaseName: string;
    agentId: string;
    phaseNumber: 1 | 2;
    processBatch: (
        batch: TInput[],
        batchNumber: number,
        totalBatches: number
    ) => Promise<TOutput[]>;
}

/**
 * Motor genérico y unificado para procesar colecciones en lotes controlados con:
 * - Control estricto de concurrencia
 * - Monitoreo transparente de estado
 * - Sin supresión silenciosa de errores
 */
export async function processBatches<TInput, TOutput>(
    items: TInput[],
    options: BatchProcessOptions<TInput, TOutput>,
    onProgress: (progress: AnalysisProgress) => void
): Promise<TOutput[]> {
    if (!items || items.length === 0) {
        onProgress({
            log: `[${options.phaseName}] Omitido: No hay elementos para procesar.`,
            agentId: options.agentId,
            status: 'COMPLETADO',
            phase: options.phaseNumber
        });
        return [];
    }

    const batches: TInput[][] = [];
    for (let i = 0; i < items.length; i += options.batchSize) {
        batches.push(items.slice(i, i + options.batchSize));
    }

    onProgress({
        log: `[${options.phaseName}] Procesando ${items.length} puntos en ${batches.length} lotes (concurrencia máx: ${options.concurrency})...`,
        agentId: options.agentId,
        status: 'TRABAJANDO',
        phase: options.phaseNumber
    });

    const batchResults = await mapWithConcurrency<TInput[], BatchResult<TOutput>>(
        batches,
        options.concurrency,
        async (batch, index) => {
            const batchNumber = index + 1;
            onProgress({
                log: `[${options.phaseName}] Iniciando lote ${batchNumber}/${batches.length} (${batch.length} elementos)...`,
                agentId: options.agentId,
                status: 'TRABAJANDO',
                phase: options.phaseNumber
            });

            try {
                const data = await options.processBatch(batch, batchNumber, batches.length);
                onProgress({
                    log: `[${options.phaseName}] Lote ${batchNumber}/${batches.length} completado con éxito (${data.length} hallazgos).`,
                    agentId: options.agentId,
                    status: 'TRABAJANDO',
                    phase: options.phaseNumber
                });
                return { success: true, data, batchNumber };
            } catch (error) {
                const message = error instanceof Error ? error.message : "Error imprevisto en lote";
                onProgress({
                    log: `[${options.phaseName}] ⚠️ Advertencia: Falló el lote ${batchNumber}/${batches.length}: ${message}.`,
                    agentId: options.agentId,
                    status: 'FALLO',
                    phase: options.phaseNumber
                });
                return { success: false, data: [], error: message, batchNumber };
            }
        }
    );

    const failedBatches = batchResults.filter(r => !r.success);
    const successfulItems = batchResults.flatMap(r => r.data);

    if (failedBatches.length > 0) {
        const failureRatio = failedBatches.length / batches.length;
        onProgress({
            log: `[${options.phaseName}] Completado con contingencias: ${failedBatches.length} de ${batches.length} lotes fallaron.`,
            agentId: options.agentId,
            status: failureRatio > 0.5 ? 'FALLO' : 'TRABAJANDO',
            phase: options.phaseNumber
        });

        // Si la tasa de fallos supera el 75%, el análisis no es técnicamente confiable
        if (failureRatio >= 0.75 && batches.length > 1) {
            throw new Error(`[${options.phaseName}] Tasa crítica de fallos: ${failedBatches.length}/${batches.length} lotes no pudieron ser procesados.`);
        }
    } else {
        onProgress({
            log: `[${options.phaseName}] Procesamiento completado al 100%: ${successfulItems.length} elementos consolidados.`,
            agentId: options.agentId,
            status: 'COMPLETADO',
            phase: options.phaseNumber
        });
    }

    return successfulItems;
}

/**
 * Genera un ID determinista y estable para eventos de la línea de tiempo.
 */
function createDeterministicTimelineId(date: string, description: string, index: number): string {
    const raw = `${date.trim()}|${description.slice(0, 40).trim()}|${index}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    return `tl-${Math.abs(hash).toString(36)}-${index}`;
}

/**
 * Deduplica fuentes de búsqueda por URI normalizada y título.
 */
function deduplicateSources(sources: GroundingSource[]): GroundingSource[] {
    const sourceMap = new Map<string, GroundingSource>();
    for (const source of sources) {
        if (!source || (!source.uri && !source.title)) continue;
        const key = (source.uri || source.title).trim().toLowerCase();
        if (!sourceMap.has(key)) {
            sourceMap.set(key, source);
        }
    }
    return Array.from(sourceMap.values());
}

/**
 * Valida semánticamente los puntos críticos extraídos del JSON.
 */
function sanitizeCriticalPoints(rawPoints: unknown[]): Omit<CriticalPoint, 'id'>[] {
    if (!Array.isArray(rawPoints)) return [];
    return rawPoints.filter((item): item is Omit<CriticalPoint, 'id'> => {
        if (!item || typeof item !== 'object') return false;
        const p = item as Record<string, unknown>;
        return typeof p.type === 'string' &&
            typeof p.excerpt === 'string' &&
            typeof p.analysis === 'string' &&
            p.analysis.trim().length > 0;
    });
}

// ============================================================================
// 2. FASES MODULARES DE ANÁLISIS JURÍDICO
// ============================================================================

/**
 * FASE 0: Investigación web orientada y concurrente con deduplicación de fuentes.
 */
const performWebResearch_Phase0 = async (
    primaryDocumentText: string,
    onProgress: (progress: AnalysisProgress) => void
): Promise<{ searchResultsText: string; allSources: GroundingSource[] }> => {
    onProgress({
        log: "[Fase 0: Investigación Web] Analizando documento para planificar líneas de búsqueda jurídica...",
        agentId: 'web_research',
        status: 'TRABAJANDO',
        phase: 1
    });

    const queryGenInstruction = Prompts.getWebSearchQueryGenerationPrompt(primaryDocumentText);

    const queryGenResponse = await generateContentWithRetry({
        model: MODEL_FAST,
        contents: "Genera las consultas de búsqueda basadas en las instrucciones.",
        config: {
            systemInstruction: queryGenInstruction,
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: Prompts.WEB_SEARCH_QUERY_GENERATION_SCHEMA,
        }
    }, onProgress, "Planificador de Investigación");

    const { searchQueries } = parseJsonResponse<{ searchQueries: string[] }>(queryGenResponse.text);

    if (!searchQueries || searchQueries.length === 0) {
        onProgress({
            log: "[Fase 0: Investigación Web] No se identificaron temas que requieran consulta externa. Continuando con el acervo procesal interno.",
            agentId: 'web_research',
            status: 'COMPLETADO',
            phase: 1
        });
        return { searchResultsText: '', allSources: [] };
    }

    onProgress({
        log: `[Fase 0: Investigación Web] ${searchQueries.length} líneas de búsqueda identificadas. Ejecutando con concurrencia controlada (máx ${WEB_SEARCH_CONCURRENCY_LIMIT} simultáneas)...`,
        agentId: 'web_research',
        status: 'TRABAJANDO',
        phase: 1
    });

    const searchOutputs = await mapWithConcurrency<{ query: string; index: number }, { text: string; sources: GroundingSource[] } | null>(
        searchQueries.map((query, index) => ({ query, index })),
        WEB_SEARCH_CONCURRENCY_LIMIT,
        async ({ query, index }) => {
            onProgress({
                log: `[Fase 0: Búsqueda ${index + 1}/${searchQueries.length}] Consultando: "${query.substring(0, 55)}..."`,
                agentId: 'web_research',
                status: 'TRABAJANDO',
                phase: 1
            });

            try {
                const { text, sources } = await performWebSearch(query);
                let formattedBlock = `<FUENTE_EXTERNA_JURISPRUDENCIAL CONSULTA="${query.substring(0, 60)}">\n`;
                formattedBlock += `INFORME HERMENÉUTICO PARA: "${query}"\n\n`;
                formattedBlock += `SÍNTESIS DE LA DOCTRINA/PRECEDENTE:\n${text}\n\n`;
                formattedBlock += `FUENTES Y PRECEDENTES CITADOS:\n${(sources || []).map(s => `- ${s.title}: ${s.uri}`).join('\n')}\n`;
                formattedBlock += `</FUENTE_EXTERNA_JURISPRUDENCIAL>\n\n`;

                onProgress({
                    log: `[Fase 0: Búsqueda ${index + 1}/${searchQueries.length}] Completada: "${query.substring(0, 40)}..."`,
                    agentId: 'web_research',
                    status: 'TRABAJANDO',
                    phase: 1
                });

                return { text: formattedBlock, sources: sources || [] };
            } catch (error) {
                const message = error instanceof Error ? error.message : "Error desconocido";
                onProgress({
                    log: `[Fase 0: Búsqueda ${index + 1}/${searchQueries.length}] ⚠️ Búsqueda fallida para "${query.substring(0, 35)}...": ${message}. Continuando...`,
                    agentId: 'web_research',
                    status: 'TRABAJANDO',
                    phase: 1
                });
                return null;
            }
        }
    );

    const validResults = searchOutputs.filter((r): r is { text: string; sources: GroundingSource[] } => r !== null);
    const combinedText = validResults.map(r => r.text).join('\n\n');
    const rawSources = validResults.flatMap(r => r.sources);
    const deduplicatedSources = deduplicateSources(rawSources);

    onProgress({
        log: `[Fase 0: Investigación Web] Búsqueda finalizada. ${validResults.length}/${searchQueries.length} consultas exitosas, ${deduplicatedSources.length} fuentes indexadas.`,
        agentId: 'web_research',
        status: 'COMPLETADO',
        phase: 1
    });

    return { searchResultsText: combinedText, allSources: deduplicatedSources };
};

/**
 * FASE 1: Análisis forense integral con paginación protegida contra duplicados
 * y corrección del ciclo hasMore.
 */
const performConsortiumAnalysis_Phase1 = async (
    combinedContents: string,
    documentType: CaseDocumentType,
    onProgress: (progress: AnalysisProgress) => void
): Promise<IntegralAnalysisResponse> => {
    onProgress({
        log: `[Fase 1: Deconstrucción Integral] Activando consorcio multidimensional (narrativa, lógica formal, coherencia probatoria y dogmática sustantiva)...`,
        agentId: 'consortium',
        status: 'TRABAJANDO',
        phase: 1
    });

    const firstPassSystemInstruction = Prompts.getIntegralAnalysisPrompt(documentType);

    const firstPassResponse = await generateContentWithRetry({
        model: MODEL_FAST,
        contents: combinedContents,
        config: {
            systemInstruction: firstPassSystemInstruction,
            temperature: 0.4,
            responseMimeType: "application/json",
            responseSchema: Prompts.INTEGRAL_ANALYSIS_SCHEMA
        }
    }, onProgress, 'Consorcio de Deconstrucción Legal');

    const initialParsed = parseJsonResponse<IntegralAnalysisResponse>(firstPassResponse.text);
    let allCriticalPoints = sanitizeCriticalPoints(initialParsed.criticalPoints || []);

    // Claves para control estricto de deduplicación
    const existingKeys = new Set<string>(
        allCriticalPoints.map(cp => `${(cp.title || '').trim().toLowerCase()}|${(cp.excerpt || '').slice(0, 50).trim().toLowerCase()}`)
    );

    onProgress({
        log: `[Fase 1: Deconstrucción Integral] Análisis de primer pase finalizado: ${allCriticalPoints.length} puntos críticos identificados.`,
        findingsCount: allCriticalPoints.length,
        status: 'TRABAJANDO',
        phase: 1
    });

    let hasMore = Boolean(initialParsed.hasMoreCriticalPoints);
    let pageCount = 1;

    // Paginación protegida contra duplicados y con parada determinista
    while (hasMore && pageCount < MAX_CRITICAL_POINT_PAGES) {
        pageCount++;
        onProgress({
            log: `[Fase 1: Paginación Forense] Iteración ${pageCount}/${MAX_CRITICAL_POINT_PAGES}: Buscando vulnerabilidades adicionales en profundidad...`,
            agentId: 'iterator',
            status: 'TRABAJANDO',
            phase: 1
        });

        const continuationInstruction = Prompts.getContinuationAnalysisPrompt(allCriticalPoints);

        const continuationResponse = await generateContentWithRetry({
            model: MODEL_FAST,
            contents: combinedContents,
            config: {
                systemInstruction: continuationInstruction,
                temperature: 0.5,
                responseMimeType: "application/json",
                responseSchema: Prompts.CONTINUATION_SCHEMA,
            }
        }, onProgress, `Analista Iterativo (Lote ${pageCount})`);

        const continuationParsed = parseJsonResponse<{ criticalPoints: Omit<CriticalPoint, 'id'>[]; hasMoreCriticalPoints?: boolean }>(continuationResponse.text);
        const newPoints = sanitizeCriticalPoints(continuationParsed.criticalPoints || []);

        if (newPoints.length === 0) {
            onProgress({
                log: `[Fase 1: Paginación Forense] No se detectaron nuevos hallazgos en la iteración ${pageCount}. Finalizando barrido.`,
                agentId: 'iterator',
                status: 'COMPLETADO',
                phase: 1
            });
            hasMore = false;
            break;
        }

        let addedCount = 0;
        for (const point of newPoints) {
            const key = `${(point.title || '').trim().toLowerCase()}|${(point.excerpt || '').slice(0, 50).trim().toLowerCase()}`;
            if (!existingKeys.has(key)) {
                allCriticalPoints.push(point);
                existingKeys.add(key);
                addedCount++;
            }
        }

        onProgress({
            log: `[Fase 1: Paginación Forense] Iteración ${pageCount}: ${addedCount} nuevos hallazgos incorporados (Total consolidado: ${allCriticalPoints.length}).`,
            agentId: 'iterator',
            status: 'TRABAJANDO',
            phase: 1,
            findingsCount: allCriticalPoints.length
        });

        // Actualizamos hasMore solo si hubo nuevos puntos y el modelo lo solicita
        hasMore = Boolean(continuationParsed.hasMoreCriticalPoints);
    }

    onProgress({
        log: `[Fase 1: Deconstrucción Integral] Consorcio completado con éxito. ${allCriticalPoints.length} puntos críticos verificados.`,
        agentId: 'consortium',
        status: 'COMPLETADO',
        phase: 1,
        findingsCount: allCriticalPoints.length
    });

    return { ...initialParsed, criticalPoints: allCriticalPoints };
};

/**
 * FASE 2: Análisis ofensivo 'Punto de Fractura' a través del motor unificado de lotes.
 */
const performFracturePointAnalysis_Phase2 = async (
    criticalPoints: CriticalPoint[],
    fullDocumentText: string,
    onProgress: (progress: AnalysisProgress) => void
): Promise<FracturePointResponseItem[]> => {
    return processBatches<CriticalPoint, FracturePointResponseItem>(
        criticalPoints,
        {
            batchSize: 5,
            concurrency: BATCH_CONCURRENCY_LIMIT,
            phaseName: 'Fase 2: Punto de Fractura',
            agentId: 'fracture',
            phaseNumber: 2,
            processBatch: async (batch, batchNumber) => {
                const fracturePointInstruction = Prompts.getFracturePointAnalysisPrompt(batch, fullDocumentText);
                const fracturePointResponse = await generateContentWithRetry({
                    model: MODEL_FAST,
                    contents: "Analiza los puntos críticos para encontrar el 'Punto de Fractura' sistémico basado en las instrucciones.",
                    config: {
                        systemInstruction: fracturePointInstruction,
                        temperature: 0.6,
                        responseMimeType: "application/json",
                        responseSchema: Prompts.FRACTURE_POINT_ANALYSIS_SCHEMA,
                    }
                }, onProgress, `Analista de Punto de Fractura (Lote ${batchNumber})`);

                const parsed = parseJsonResponse<{ fracturePointResponses: FracturePointResponseItem[] }>(fracturePointResponse.text);
                return parsed.fracturePointResponses || [];
            }
        },
        onProgress
    );
};

/**
 * FASE 3: Análisis defensivo 'Blindaje Jurisprudencial' a través del motor unificado de lotes.
 */
const performJurisprudentialShielding_Phase3 = async (
    criticalPoints: CriticalPoint[],
    fullDocumentText: string,
    onProgress: (progress: AnalysisProgress) => void
): Promise<JurisprudentialShieldingResponseItem[]> => {
    return processBatches<CriticalPoint, JurisprudentialShieldingResponseItem>(
        criticalPoints,
        {
            batchSize: 5,
            concurrency: BATCH_CONCURRENCY_LIMIT,
            phaseName: 'Fase 3: Blindaje Jurisprudencial',
            agentId: 'shielding',
            phaseNumber: 2,
            processBatch: async (batch, batchNumber) => {
                const shieldingInstruction = Prompts.getJurisprudentialShieldingPrompt(batch, fullDocumentText);
                const shieldingResponse = await generateContentWithRetry({
                    model: MODEL_FAST,
                    contents: "Analiza los puntos críticos para encontrar el 'Blindaje Jurisprudencial' basado en las instrucciones.",
                    config: {
                        systemInstruction: shieldingInstruction,
                        temperature: 0.5,
                        responseMimeType: "application/json",
                        responseSchema: Prompts.JURISPRUDENTIAL_SHIELDING_SCHEMA,
                    }
                }, onProgress, `Estratega de Blindaje Jurisprudencial (Lote ${batchNumber})`);

                const parsed = parseJsonResponse<{ jurisprudentialShieldingResponses: JurisprudentialShieldingResponseItem[] }>(shieldingResponse.text);
                return parsed.jurisprudentialShieldingResponses || [];
            }
        },
        onProgress
    );
};

/**
 * FASE 4: Análisis de inconsistencias probatorias y contraste factual.
 */
const performEvidentiaryInconsistencyAnalysis_Phase4 = async (
    fullDocumentText: string,
    onProgress: (progress: AnalysisProgress) => void
): Promise<EvidentiaryInconsistencyResponseItem> => {
    if (!fullDocumentText.includes('<PRUEBA') && !fullDocumentText.includes('ÁMBITO II:')) {
        onProgress({
            log: "[Fase 4: Coherencia Probatoria] Omitido: No se aportaron anexos probatorios adicionales para contrastar.",
            agentId: 'coherence',
            status: 'COMPLETADO',
            phase: 2
        });
        return { inconsistencies: [] };
    }

    onProgress({
        log: "[Fase 4: Coherencia Probatoria FEA-V3] Iniciando auditoría con delimitación Nonce y protocolo Grounding Zero...",
        agentId: 'coherence',
        status: 'TRABAJANDO',
        phase: 2
    });

    const inconsistencyInstruction = Prompts.getEvidentiaryInconsistencyPrompt(fullDocumentText);

    const inconsistencyResponse = await generateContentWithRetry({
        model: MODEL_FAST,
        contents: "Ejecuta la auditoría forense de coherencia probatoria bajo estándar FEA-V3 y responde exclusivamente en JSON.",
        config: {
            systemInstruction: inconsistencyInstruction,
            temperature: 0.2, // Reducido para maximizar el determinismo fáctico y erradicar alucinaciones
            responseMimeType: "application/json",
            responseSchema: Prompts.EVIDENTIARY_INCONSISTENCY_SCHEMA,
        }
    }, onProgress, "Agente de Coherencia Probatoria FEA-V3");

    // Compuerta de Validación Determinista V3 (Grounding Zero Validator):
    const parsed = parseJsonResponse<EvidentiaryInconsistencyResponseItem>(inconsistencyResponse.text);
    const rawItems = parsed?.inconsistencies || [];

    // Normalización de texto para búsqueda de subcadena tolerante a saltos de línea/espacios múltiples
    const normalizedDoc = fullDocumentText.replace(/\s+/g, ' ').toLowerCase();

    const verifiedInconsistencies = rawItems.filter(item => {
        if (!item.claimInDocument || typeof item.claimInDocument !== 'string') return false;
        const normalizedClaim = item.claimInDocument.trim().replace(/\s+/g, ' ').toLowerCase();
        if (normalizedClaim.length < 5) return false;

        // Verificación de existencia fáctica de la afirmación en el documento (anti-alucinación estricta)
        const claimFound = normalizedDoc.includes(normalizedClaim);
        if (!claimFound) {
            // Tolerancia de ventana: si la subcadena contiene al menos 30 caracteres coincidentes
            const sample = normalizedClaim.slice(0, Math.min(30, normalizedClaim.length));
            if (!normalizedDoc.includes(sample)) {
                console.warn(`[FEA-V3 Gate] Inconsistencia descartada por fallo de subcadena (alucinación fáctica detectada): "${item.claimInDocument.slice(0, 50)}..."`);
                return false;
            }
        }
        return true;
    });

    onProgress({
        log: `[Fase 4: Coherencia Probatoria FEA-V3] Auditoría completada: ${verifiedInconsistencies.length} inconsistencias validadas determinísticamente contra el expediente.`,
        agentId: 'coherence',
        status: 'COMPLETADO',
        phase: 2
    });

    return { inconsistencies: verifiedInconsistencies };
};

/**
 * FASE 5: Extracción de línea de tiempo con identificadores deterministas.
 */
const extractTimeline_Phase5 = async (
    fullDocumentText: string,
    onProgress: (progress: AnalysisProgress) => void
): Promise<TimelineEvent[]> => {
    onProgress({
        log: "[Fase 5: Línea de Tiempo] Extrayendo y ordenando cronológicamente los hitos procesales...",
        agentId: 'timeline',
        status: 'TRABAJANDO',
        phase: 2
    });

    try {
        const result = await extractTimelineEvents(fullDocumentText);
        const events = (result.events || []).map((event: Omit<TimelineEvent, 'id'>, index: number) => ({
            ...event,
            id: createDeterministicTimelineId(event.date || '', event.description || '', index)
        }));

        onProgress({
            log: `[Fase 5: Línea de Tiempo] Extracción completada exitosamente. ${events.length} eventos procesales catalogados.`,
            agentId: 'timeline',
            status: 'COMPLETADO',
            phase: 2
        });
        return events;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        onProgress({
            log: `[Fase 5: Línea de Tiempo] ⚠️ Advertencia: No se pudo extraer la cronología: ${message}.`,
            agentId: 'timeline',
            status: 'FALLO',
            phase: 2
        });
        return [];
    }
};

// ============================================================================
// 3. ORQUESTADOR PRINCIPAL (CASCADA SINÉRGICA SOBERANA)
// ============================================================================

/**
 * Orquesta el análisis integral del caso con:
 * - Separación rigurosa de proveniencia epistemológica (Hechos vs. Pruebas vs. Doctrina Externa)
 * - Integración real del dictamen y auditorías del Agente Supervisor
 * - Concurrencia acotada y eliminación de duplicidades
 * - Trazabilidad probatoria y ausencia de fallos silenciosos
 */
export const analyzeCaseDocument = async (
    primaryDocumentText: string,
    evidenceTexts: { name: string; text: string }[],
    documentType: CaseDocumentType,
    onProgress: (progress: AnalysisProgress) => void,
    simpleId: () => string
): Promise<{ baseAnalysis: IntegralAnalysisResponse; enrichedAnalysis: AnalysisReport }> => {
    try {
        // --- ETAPA 1: INDEXACIÓN EN MEMORIA CENTRALIZADA ---
        const dummyPrimary: Attachment = {
            name: 'Documento_Principal.pdf',
            size: primaryDocumentText.length,
            type: 'application/pdf',
            isPrimary: true,
            evidenceType: 'DOCUMENT',
            extractedText: primaryDocumentText,
            status: 'ready'
        };

        const dummyEvidences: Attachment[] = evidenceTexts.map(e => ({
            name: e.name,
            size: e.text.length,
            type: 'text/plain',
            isPrimary: false,
            evidenceType: 'DOCUMENT',
            extractedText: e.text,
            status: 'ready'
        }));

        const caseContext = contextCacheService.createOrGetContext(dummyPrimary, dummyEvidences);
        onProgress({
            log: `[Memoria de Contexto] Expediente indexado (${caseContext.totalWordCount} palabras, ~${caseContext.estimatedTokens} tokens). Hash: ${caseContext.cacheId}`,
            phase: 1
        });

        // --- ETAPA 2: INVESTIGACIÓN WEB + DICTAMEN DEL SUPERVISOR AGÉNTICO ---
        // Ejecución concurrente pero con captura activa del supervisorDecision
        const [webResearch, supervisorDecision] = await Promise.all([
            performWebResearch_Phase0(primaryDocumentText, onProgress),
            supervisorAgent.orchestrateAutonomousInvestigation(caseContext, documentType, onProgress).catch(err => {
                console.warn("[Supervisor] Fallback por contingencia:", err);
                return null as SupervisorDecision | null;
            })
        ]);

        const { searchResultsText, allSources } = webResearch;
        const combinedSourcesMap = new Map<string, GroundingSource>();
        allSources.forEach(s => combinedSourcesMap.set((s.uri || s.title).trim().toLowerCase(), s));

        // Incorporación activa de fuentes jurisprudenciales halladas por el supervisor
        if (supervisorDecision?.autonomousToolInvocations) {
            for (const invocation of supervisorDecision.autonomousToolInvocations) {
                if (invocation.result && Array.isArray(invocation.result.topSources)) {
                    for (const s of invocation.result.topSources) {
                        if (s && (s.uri || s.title)) {
                            const key = (s.uri || s.title).trim().toLowerCase();
                            if (!combinedSourcesMap.has(key)) {
                                combinedSourcesMap.set(key, { title: s.title || 'Precedente Supervisor', uri: s.uri || '' });
                            }
                        }
                    }
                }
            }
        }
        const mergedGroundingSources = Array.from(combinedSourcesMap.values());

        // --- ETAPA 3: SEPARACIÓN RIGUROSA DE PROVENIENCIA EPISTEMOLÓGICA ---
        const evidenceParts = evidenceTexts
            .map(evidence => `<PRUEBA NOMBRE_ARCHIVO="${evidence.name}">\n${evidence.text}\n</PRUEBA>`)
            .join('\n\n');

        // Formateo explícito del dictamen del supervisor para guiar el consorcio
        let supervisorBlock = '';
        if (supervisorDecision) {
            supervisorBlock = [
                `<DICTAMEN_SUPERVISOR_SOVEREIGN>`,
                `DIAGNÓSTICO ESTRATÉGICO: ${supervisorDecision.strategicDiagnosis}`,
                `VEREDICTO SINTETIZADO: ${supervisorDecision.synthesizedVerdict}`,
                `RIESGOS JURÍDICOS IDENTIFICADOS:\n${supervisorDecision.identifiedLegalRisks.map(r => `- ${r}`).join('\n')}`,
                `ACCIONES TÉCNICAS RECOMENDADAS:\n${supervisorDecision.recommendedActions.map(a => `- ${a}`).join('\n')}`,
                supervisorDecision.autonomousToolInvocations.length > 0
                    ? `AUDITORÍAS PROCESALES Y TÉRMINOS COMPUTADOS:\n${supervisorDecision.autonomousToolInvocations.map(inv => `• [${inv.toolName}] ${JSON.stringify(inv.result)}`).join('\n')}`
                    : '',
                `</DICTAMEN_SUPERVISOR_SOVEREIGN>`
            ].filter(Boolean).join('\n');
        }

        const combinedContents = [
            `=== ÁMBITO I: DOCUMENTO PROCESAL PRINCIPAL (EXPEDIENTE DEL CASO) ===`,
            `TIPO DE ACTO PROCESAL: ${documentType}`,
            `<DOCUMENTO_PRINCIPAL TIPO="${documentType}">\n${primaryDocumentText}\n</DOCUMENTO_PRINCIPAL>`,

            evidenceParts
                ? `=== ÁMBITO II: ACERVO PROBATORIO APORTADO (ANEXOS Y FOLIOS) ===\n${evidenceParts}`
                : '',

            supervisorBlock
                ? `=== ÁMBITO III: AUDITORÍA Y CONTROL ESTRATÉGICO (MAGISTRADO SUPERVISOR) ===\n${supervisorBlock}`
                : '',

            searchResultsText
                ? `=== ÁMBITO IV: INVESTIGACIÓN JURISPRUDENCIAL Y EXTERNA (CANON HERMENÉUTICO) ===\n${searchResultsText}`
                : '',

            `=== REGLAS EPISTEMOLÓGICAS OBLIGATORIAS DE VALORACIÓN JURÍDICA ===
1. REGLA DE HECHOS DEL CASO: Solo las afirmaciones fácticas contenidas en el ÁMBITO I y ÁMBITO II constituyen la verdad material u objeto de controversia del expediente.
2. REGLA DE NO-CONTAMINACIÓN: Los precedentes y normativas del ÁMBITO III y ÁMBITO IV operan como criterios de validez, hermenéutica o precedentes vinculantes; NO deben invocarse como hechos acontecidos en el litigio si no obran en el expediente.
3. REGLA DE DISCREPANCIA: Ante cualquier divergencia fáctica entre fuentes externas y el expediente, prevalece taxativamente el texto del expediente.`
        ].filter(Boolean).join('\n\n');

        // --- ETAPA 4: ANÁLISIS FORENSE INTEGRAL (FASE 1) ---
        const phase1Result = await performConsortiumAnalysis_Phase1(
            combinedContents,
            documentType,
            onProgress
        );

        const criticalPointsWithIds: CriticalPoint[] = phase1Result.criticalPoints.map(cp => ({
            ...cp,
            id: simpleId()
        }));

        // --- ETAPA 5: ENRIQUECIMIENTO PARALELO CON CONTROL DE CONCURRENCIA (FASES 2, 3, 4, 5) ---
        onProgress({
            log: `[Enriquecimiento Soberano] Desplegando en paralelo: Punto de Fractura, Blindaje Jurisprudencial, Coherencia Probatoria y Línea de Tiempo...`,
            status: 'TRABAJANDO',
            phase: 2
        });

        const [
            phase2Result,
            phase3Result,
            phase4Result,
            timelineResult,
        ] = await Promise.all([
            performFracturePointAnalysis_Phase2(criticalPointsWithIds, combinedContents, onProgress),
            performJurisprudentialShielding_Phase3(criticalPointsWithIds, combinedContents, onProgress),
            performEvidentiaryInconsistencyAnalysis_Phase4(combinedContents, onProgress),
            extractTimeline_Phase5(combinedContents, onProgress),
        ]);

        // --- ETAPA 6: FUSIÓN DE RESULTADOS Y AUDITORÍA DE CONSISTENCIA ---
        onProgress({
            log: "Consolidando y fusionando informe de litigación estratégica...",
            agentId: 'synthesizer',
            status: 'TRABAJANDO',
            phase: 2
        });

        const fractureMap = new Map(phase2Result.map(item => [item.criticalPointId, item.fracturePointAnalysis]));
        const shieldingMap = new Map(phase3Result.map(item => [item.criticalPointId, item.jurisprudentialShielding]));

        const enrichedCriticalPoints = criticalPointsWithIds.map(cp => {
            const enrichedCp: CriticalPoint = { ...cp };
            if (fractureMap.has(cp.id)) {
                enrichedCp.fracturePointAnalysis = fractureMap.get(cp.id);
            }
            if (shieldingMap.has(cp.id)) {
                enrichedCp.jurisprudentialShielding = shieldingMap.get(cp.id);
            }
            return enrichedCp;
        });

        const inconsistenciesWithIds = (phase4Result.inconsistencies || []).map(inc => ({
            ...inc,
            id: simpleId()
        }));

        // Enriquecemos la auditoría pre-flight con datos concretos del supervisor si existen
        const preFlightAudit = phase1Result.preFlightAudit ? { ...phase1Result.preFlightAudit } : undefined;
        if (preFlightAudit && supervisorDecision) {
            const termsInvocation = supervisorDecision.autonomousToolInvocations.find(i => i.toolName === 'computeProceduralTerms');
            if (termsInvocation?.result && (!preFlightAudit.proceduralTermsAudit || preFlightAudit.proceduralTermsAudit.toLowerCase().includes('insuficiente'))) {
                preFlightAudit.proceduralTermsAudit = `Auditoría Autónoma: Vencimiento calculado ${termsInvocation.result.estimatedDeadline || ''} (${termsInvocation.result.ruleApplied || ''}). Acción: ${termsInvocation.result.actionType || ''}.`;
            }
        }

        const enrichedReport: AnalysisReport = {
            governanceProtocolVersion: phase1Result.governanceProtocolVersion || 'LAGP V5 - Legal Adversarial Governance Protocol',
            caseOverview: phase1Result.caseOverview,
            preFlightAudit,
            intermediateProductsStatus: phase1Result.intermediateProductsStatus,
            legalContradictions: phase1Result.legalContradictions,
            narrativeAnalysis: phase1Result.narrativeAnalysis,
            alternativeTheories: phase1Result.alternativeTheories,
            criticalPoints: enrichedCriticalPoints,
            evidentiaryInconsistencies: inconsistenciesWithIds,
            groundingSources: mergedGroundingSources,
            timeline: timelineResult,
        };

        onProgress({
            log: `Análisis de litigación estratégica completado: ${enrichedCriticalPoints.length} puntos blindados, ${timelineResult.length} hitos cronológicos y ${mergedGroundingSources.length} fuentes indexadas.`,
            agentId: 'synthesizer',
            status: 'COMPLETADO',
            isFinal: true
        });

        return { baseAnalysis: phase1Result, enrichedAnalysis: enrichedReport };

    } catch (error) {
        const message = error instanceof Error ? error.message : "Ocurrió un error imprevisto durante el análisis.";
        onProgress({
            log: `Análisis interrumpido por contingencia técnica: ${message}`,
            error: message,
            isFinal: true,
            status: 'FALLO'
        });
        throw new Error(`Análisis fallido: ${message}`);
    }
};
