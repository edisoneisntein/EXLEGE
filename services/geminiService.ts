import {
    GoogleGenAI,
    type GenerateContentResponse,
} from '@google/genai';

import type {
    AnalysisReport,
    AnalysisProgress,
    AIPersonality,
    ArgumentAnalysis,
    AmendmentProposal,
    CaseDocumentType,
    ComparativeAnalysisReport,
    CriticalPoint,
    FullAnalysisResult,
    GroundingSource,
    JudgePersonality,
    LegalActionProposal,
    RefinementMotion,
    TimelineExtractionResponse,
} from '../types';

import type { Message } from '../hooks/useChatSession';
import * as Prompts from './promptManager';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    models: {
        primary: 'gemini-3.5-flash',
        fallbacks: [
            'gemini-flash-latest',
            'gemini-3.1-flash-lite',
        ],
    },

    retry: {
        maxAttempts: 3,
        initialDelayMs: 1_000,
        maxDelayMs: 30_000,
        jitterMs: 250,
    },

    limits: {
        maxRetryModels: 3,
        maxChatMessages: 6,
        maxRagSnippets: 12,
        maxSnippetChars: 8_000,
        maxQueryChars: 10_000,
        maxTranslationChars: 100_000,
        maxComparisonChars: 150_000,
        maxTimelineChars: 200_000,
        maxDraftChars: 200_000,
        maxNarrativeChars: 100_000,
    },

    temperature: {
        deterministic: 0,
        extraction: 0.1,
        legalAnalysis: 0.3,
        drafting: 0.5,
        conversational: 0.6,
    },
} as const;

// ============================================================================
// TYPES
// ============================================================================

type GenerateRequest =
    Parameters<GoogleGenAI['models']['generateContent']>[0];

type ProgressCallback =
    (progress: AnalysisProgress) => void;

interface RetryPolicy {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    jitterMs: number;
}

interface JsonRequestOptions<T> {
    request: GenerateRequest;
    agentName: string;
    schema: unknown;
    onProgress?: ProgressCallback;
    validate?: (value: T) => boolean;
}

interface RagSnippet {
    source: string;
    content: string;
}

// ============================================================================
// CLIENT
// ============================================================================

function getApiKey(): string {
    const apiKey =
        process.env.API_KEY ??
        process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error(
            'API_KEY o GEMINI_API_KEY no está configurada.'
        );
    }

    return apiKey;
}

function createAIClient(): GoogleGenAI {
    return new GoogleGenAI({
        apiKey: getApiKey(),
    });
}

const ai = createAIClient();

// ============================================================================
// GENERIC UTILITIES
// ============================================================================

function normalizeText(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : '';
}

function clampText(
    value: string,
    maxChars: number
): string {
    if (value.length <= maxChars) {
        return value;
    }

    return `${value.slice(0, maxChars)}\n\n[CONTENIDO TRUNCADO]`;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function randomJitter(max: number): number {
    return Math.floor(Math.random() * Math.max(0, max));
}

function emitProgress(
    callback: ProgressCallback | undefined,
    log: string,
    agentId?: string,
    status?: AnalysisProgress['status']
): void {
    if (!callback) {
        return;
    }

    try {
        callback({
            log,
            ...(agentId ? { agentId } : {}),
            ...(status ? { status } : {}),
        });
    } catch {
        // El sistema de progreso/UI nunca debe abortar una inferencia.
    }
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function errorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

function errorStatus(error: unknown): number | undefined {
    const candidate = error as {
        status?: unknown;
        statusCode?: unknown;
        response?: {
            status?: unknown;
        };
    };

    const values = [
        candidate?.status,
        candidate?.statusCode,
        candidate?.response?.status,
    ];

    for (const value of values) {
        if (
            typeof value === 'number' &&
            Number.isFinite(value)
        ) {
            return value;
        }

        if (
            typeof value === 'string' &&
            /^\d{3}$/.test(value)
        ) {
            return Number(value);
        }
    }

    return undefined;
}

function classifyError(error: unknown): {
    retryable: boolean;
    modelFallbackEligible: boolean;
    status?: number;
} {
    const message = errorMessage(error).toLowerCase();
    const status = errorStatus(error);

    // Errores donde cambiar de modelo puede tener sentido.
    const modelFallbackEligible =
        status === 404 ||
        message.includes('model not found') ||
        message.includes('model_not_found') ||
        message.includes('unsupported model') ||
        message.includes('model is not supported');

    // Errores transitorios.
    const retryable =
        status === 408 ||
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('network') ||
        message.includes('socket') ||
        message.includes('econnreset') ||
        message.includes('temporarily unavailable') ||
        message.includes('resource exhausted') ||
        message.includes('quota exceeded');

    return {
        retryable,
        modelFallbackEligible,
        status,
    };
}

// ============================================================================
// BACKOFF
// ============================================================================

function calculateBackoff(
    attempt: number,
    policy: RetryPolicy
): number {
    const exponential = Math.min(
        policy.initialDelayMs * 2 ** attempt,
        policy.maxDelayMs
    );

    return exponential + randomJitter(policy.jitterMs);
}

// ============================================================================
// JSON PARSING
// ============================================================================

/**
 * Extrae JSON de respuestas que eventualmente vengan rodeadas de fences Markdown.
 * No intenta alterar o mutilar arbitrariamente la sintaxis interna del JSON.
 */
export function parseJsonResponse<T>(
    responseText: string | undefined
): T {
    const raw = normalizeText(responseText);

    if (!raw) {
        throw new Error(
            'La IA devolvió una respuesta vacía.'
        );
    }

    let jsonText = raw;

    // ```json ... ```
    const fencedMatch = raw.match(
        /^```(?:json|javascript|js|ts)?\s*([\s\S]*?)\s*```$/i
    );

    if (fencedMatch?.[1]) {
        jsonText = fencedMatch[1].trim();
    }

    // Busca el primer objeto/array si el modelo añadió texto accesorio preliminar
    if (
        !jsonText.startsWith('{') &&
        !jsonText.startsWith('[')
    ) {
        const objectStart = jsonText.indexOf('{');
        const arrayStart = jsonText.indexOf('[');

        const starts = [
            objectStart,
            arrayStart,
        ].filter(index => index >= 0);

        if (starts.length > 0) {
            const start = Math.min(...starts);
            jsonText = jsonText.slice(start);
        }
    }

    try {
        return JSON.parse(jsonText) as T;
    } catch (error) {
        console.error(
            'Respuesta JSON inválida de Gemini:',
            {
                preview: jsonText.slice(0, 2_000),
                error,
            }
        );

        throw new Error(
            'La IA devolvió JSON inválido. La respuesta no pudo ser interpretada de forma segura.'
        );
    }
}

// ============================================================================
// GENERIC GEMINI REQUEST (WITH IMMUTABLE RETRY & DISCRIMINATED FALLBACK)
// ============================================================================

export async function generateContentWithRetry(
    request: GenerateRequest,
    onProgress?: ProgressCallback,
    agentName = 'Sistema de IA'
): Promise<GenerateContentResponse> {
    const models = [
        request.model,
        ...CONFIG.models.fallbacks,
    ].filter(
        (model, index, array) =>
            model &&
            array.indexOf(model) === index
    ).slice(0, CONFIG.limits.maxRetryModels);

    const policy: RetryPolicy = {
        ...CONFIG.retry,
    };

    let lastError: unknown = null;

    for (
        let modelIndex = 0;
        modelIndex < models.length;
        modelIndex++
    ) {
        const model = models[modelIndex];

        for (
            let attempt = 0;
            attempt < policy.maxAttempts;
            attempt++
        ) {
            try {
                // Inmutabilidad estricta: nunca mutamos request.model directamente
                const modelRequest = {
                    ...request,
                    model,
                };

                emitProgress(
                    onProgress,
                    `${agentName}: ejecutando ${model} (intento ${attempt + 1}/${policy.maxAttempts}).`
                );

                return await ai.models.generateContent(
                    modelRequest
                );
            } catch (error) {
                lastError = error;

                const classification =
                    classifyError(error);

                const isLastAttempt =
                    attempt === policy.maxAttempts - 1;

                const hasFallbackModel =
                    modelIndex < models.length - 1;

                // Modelo incompatible o no encontrado: alternar inmediatamente
                if (
                    classification.modelFallbackEligible &&
                    hasFallbackModel
                ) {
                    const nextModel =
                        models[modelIndex + 1];

                    emitProgress(
                        onProgress,
                        `${agentName}: ${model} no está disponible o no es compatible. Cambiando a ${nextModel}.`
                    );

                    break;
                }

                // Error transitorio de red o cuota: reintentar con backoff
                if (
                    classification.retryable &&
                    !isLastAttempt
                ) {
                    const delay =
                        calculateBackoff(
                            attempt,
                            policy
                        );

                    emitProgress(
                        onProgress,
                        `${agentName}: error transitorio (intento ${attempt + 1}/${policy.maxAttempts}). Reintentando en ${Math.ceil(delay / 1000)}s.`
                    );

                    await sleep(delay);
                    continue;
                }

                // Si es un error definitivo no recuperable (400, Bad Request, schema inválido), abortar de inmediato
                if (
                    !classification.retryable &&
                    !classification.modelFallbackEligible
                ) {
                    throw error;
                }

                break;
            }
        }
    }

    throw createFriendlyGeminiError(lastError);
}

// ============================================================================
// FRIENDLY ERRORS
// ============================================================================

function createFriendlyGeminiError(
    error: unknown
): Error {
    const message = errorMessage(error);
    const status = errorStatus(error);

    if (
        status === 401 ||
        status === 403 ||
        /permission|denied|unauthorized|api key/i.test(message)
    ) {
        return new Error(
            'Fallo de autenticación o autorización con Gemini (401/403/Permission Denied). ' +
            'Verifique que su API Key esté configurada en Settings > Secrets con los permisos adecuados.'
        );
    }

    if (status === 429) {
        return new Error(
            'Límite de cuota de Gemini excedido (429 Too Many Requests). Espere unos segundos e inténtelo nuevamente.'
        );
    }

    if (
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    ) {
        return new Error(
            'El servicio de Gemini no se encuentra disponible temporalmente tras múltiples reintentos.'
        );
    }

    return new Error(
        `No fue posible completar la solicitud a Gemini: ${message}`
    );
}

// ============================================================================
// GENERIC JSON OPERATION
// ============================================================================

async function generateJson<T>(
    options: JsonRequestOptions<T>
): Promise<T> {
    const response =
        await generateContentWithRetry(
            options.request,
            options.onProgress,
            options.agentName
        );

    const parsed =
        parseJsonResponse<T>(
            response.text
        );

    if (
        options.validate &&
        !options.validate(parsed)
    ) {
        throw new Error(
            `${options.agentName}: la respuesta JSON no cumple con la validación de integridad esperada.`
        );
    }

    return parsed;
}

// ============================================================================
// GENERIC DRAFT OPERATION
// ============================================================================

async function generateDraft(
    systemInstruction: string,
    userInstruction: string,
    agentName: string,
    temperature: number = CONFIG.temperature.drafting
): Promise<string> {
    const response =
        await generateContentWithRetry(
            {
                model: CONFIG.models.primary,
                contents: userInstruction,
                config: {
                    systemInstruction: {
                        role: 'system',
                        parts: [
                            {
                                text: systemInstruction,
                            },
                        ],
                    },
                    temperature,
                    responseMimeType: 'application/json',
                    responseSchema: Prompts.DRAFT_SCHEMA,
                },
            },
            undefined,
            agentName
        );

    const parsed =
        parseJsonResponse<{
            draft_text: string;
        }>(response.text);

    const draft =
        normalizeText(parsed?.draft_text);

    if (draft.length < 50) {
        throw new Error(
            `${agentName}: el borrador generado está vacío o es demasiado corto.`
        );
    }

    return draft;
}

// ============================================================================
// RAG STREAMING
// ============================================================================

export async function* generateRAGResponseStream(
    query: string,
    chatHistory: Message[],
    fullResult: FullAnalysisResult,
    activeMode:
        | 'STRATEGIC_COLLABORATOR'
        | 'STRATEGIC_ADVERSARY'
        | 'JUDGE'
        | 'WITNESS',
    selectedPersonality: JudgePersonality,
): AsyncGenerator<string> {
    const safeQuery =
        clampText(
            normalizeText(query),
            CONFIG.limits.maxQueryChars
        );

    if (!safeQuery) {
        yield 'Por favor, formule una pregunta concreta sobre el expediente.';
        return;
    }

    // 1. Fase de Recuperación (Retrieval)
    const retrieverPrompt =
        Prompts.getRagRetrieverPrompt(
            safeQuery,
            chatHistory.slice(
                -CONFIG.limits.maxChatMessages
            ),
            fullResult
        );

    const retrievalResponse =
        await generateContentWithRetry(
            {
                model: CONFIG.models.primary,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: retrieverPrompt,
                            },
                        ],
                    },
                ],
                config: {
                    temperature: CONFIG.temperature.deterministic,
                    responseMimeType: 'application/json',
                    responseSchema: Prompts.RAG_RETRIEVAL_SCHEMA,
                },
            },
            undefined,
            'RAG Retriever'
        );

    const retrieval =
        parseJsonResponse<{
            retrievedSnippets?: RagSnippet[];
        }>(
            retrievalResponse.text
        );

    const snippets = Array.isArray(retrieval.retrievedSnippets)
        ? retrieval.retrievedSnippets
              .filter(
                  snippet =>
                      normalizeText(snippet?.source) &&
                      normalizeText(snippet?.content)
              )
              .slice(0, CONFIG.limits.maxRagSnippets)
        : [];

    if (snippets.length === 0) {
        yield 'No encontré información suficientemente relevante en el expediente para responder con seguridad. ¿Podría reformular la pregunta?';
        return;
    }

    const contextForGenerator = snippets
        .map(
            snippet =>
                [
                    '<SNIPPET>',
                    `FUENTE: ${clampText(snippet.source, 500)}`,
                    'CONTENIDO:',
                    clampText(snippet.content, CONFIG.limits.maxSnippetChars),
                    '</SNIPPET>',
                ].join('\n')
        )
        .join('\n\n');

    // 2. Fase de Generación Streaming
    const systemInstruction =
        Prompts.getRagGeneratorSystemInstruction(
            activeMode,
            fullResult,
            selectedPersonality,
            null
        );

    const generatorHistory = chatHistory
        .slice(-CONFIG.limits.maxChatMessages)
        .map(message => ({
            role: message.speaker === 'user' ? 'user' : 'model',
            parts: [
                {
                    text: clampText(message.text, 20_000),
                },
            ],
        }));

    const generatorContents = [
        ...generatorHistory,
        {
            role: 'user' as const,
            parts: [
                {
                    text: [
                        'Responde a la pregunta utilizando exclusivamente los fragmentos recuperados como evidencia factual del expediente.',
                        '',
                        'Si los fragmentos no permiten establecer un hecho, indícalo expresamente.',
                        'No inventes hechos, citas, artículos, jurisprudencia ni contenido documental.',
                        '',
                        'PREGUNTA:',
                        safeQuery,
                        '',
                        'FRAGMENTOS DEL EXPEDIENTE:',
                        contextForGenerator,
                    ].join('\n'),
                },
            ],
        },
    ];

    try {
        const stream = await ai.models.generateContentStream({
            model: CONFIG.models.primary,
            contents: generatorContents,
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: systemInstruction,
                        },
                    ],
                },
                temperature: CONFIG.temperature.conversational,
            },
        });

        let emittedAnyText = false;

        for await (const chunk of stream) {
            const text = normalizeText(chunk.text);
            if (text) {
                emittedAnyText = true;
                yield text;
            }
        }

        if (!emittedAnyText) {
            yield '\n\nNo se recibió contenido utilizable del modelo.';
        }
    } catch (error) {
        throw createFriendlyGeminiError(error);
    }
}

// ============================================================================
// OPENING STATEMENT
// ============================================================================

export async function generateOpeningStatement(
    activeMode:
        | 'STRATEGIC_COLLABORATOR'
        | 'WITNESS',
    fullResult: FullAnalysisResult
): Promise<string> {
    const promptFactory =
        activeMode === 'STRATEGIC_COLLABORATOR'
            ? Prompts.getVoiceCollaboratorPrompt
            : Prompts.getWitnessPrepPrompt;

    const fullPrompt = promptFactory(fullResult);
    const systemInstruction = extractSystemInstruction(fullPrompt);

    const openingInstruction =
        activeMode === 'STRATEGIC_COLLABORATOR'
            ? 'Saluda brevemente y pregunta al abogado qué punto del informe desea discutir. No agregues análisis adicional.'
            : 'Saluda brevemente al testigo y formula la primera pregunta para que exponga su versión de los hechos.';

    const response = await generateContentWithRetry(
        {
            model: CONFIG.models.primary,
            contents: openingInstruction,
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: systemInstruction,
                        },
                    ],
                },
                temperature: 0.5,
            },
        },
        undefined,
        `Turno Cero (${activeMode})`
    );

    return normalizeText(response.text);
}

function extractSystemInstruction(prompt: string): string {
    const separators = [
        '**EXPEDIENTE VIRTUAL COMPLETO (TU ÚNICA FUENTE DE VERDAD):**',
        '**EXPEDIENTE VIRTUAL COMPLETO (TU EXPEDIENTE):**',
    ];

    for (const separator of separators) {
        const index = prompt.indexOf(separator);
        if (index >= 0) {
            return prompt.slice(0, index).trim();
        }
    }

    return prompt.trim();
}

// ============================================================================
// IMAGE EVIDENCE ANALYSIS
// ============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(
            offset,
            Math.min(offset + chunkSize, bytes.length)
        );
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

export async function analyzeImageEvidence(
    fileBuffer: ArrayBuffer,
    mimeType: string
): Promise<string> {
    if (!fileBuffer.byteLength) {
        throw new Error('La imagen de evidencia está vacía.');
    }

    if (!mimeType.startsWith('image/')) {
        throw new Error(`Tipo MIME de imagen no válido: ${mimeType}`);
    }

    const base64Data = arrayBufferToBase64(fileBuffer);

    const response = await generateContentWithRetry(
        {
            model: CONFIG.models.primary,
            contents: {
                parts: [
                    {
                        text: Prompts.getImageAnalysisPrompt(),
                    },
                    {
                        inlineData: {
                            mimeType,
                            data: base64Data,
                        },
                    },
                ],
            },
            config: {
                temperature: CONFIG.temperature.extraction,
            },
        },
        undefined,
        'Analista de Imagen'
    );

    const result = normalizeText(response.text);
    if (!result) {
        throw new Error('El analista de imagen no devolvió contenido.');
    }

    return `Informe de Evidencia Visual:\n${result}`;
}

// ============================================================================
// WEB SEARCH WITH DEDUPLICATION
// ============================================================================

interface GeminiGroundingChunk {
    web?: {
        uri?: string;
        title?: string;
    };
}

function extractGroundingSources(
    response: GenerateContentResponse
): GroundingSource[] {
    const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (!Array.isArray(chunks)) {
        return [];
    }

    const unique = new Map<string, GroundingSource>();

    for (const rawChunk of chunks) {
        const chunk = rawChunk as GeminiGroundingChunk;
        const uri = normalizeText(chunk.web?.uri);

        if (!uri || unique.has(uri)) {
            continue;
        }

        unique.set(uri, {
            title: normalizeText(chunk.web?.title) || uri,
            uri,
        });
    }

    return [...unique.values()];
}

export async function performWebSearch(
    query: string
): Promise<{
    text: string;
    sources: GroundingSource[];
}> {
    const safeQuery = clampText(
        normalizeText(query),
        CONFIG.limits.maxQueryChars
    );

    if (!safeQuery) {
        throw new Error('La consulta de búsqueda no puede estar vacía.');
    }

    try {
        const response = await generateContentWithRetry(
            {
                model: CONFIG.models.primary,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: safeQuery,
                            },
                        ],
                    },
                ],
                config: {
                    systemInstruction: {
                        role: 'system',
                        parts: [
                            {
                                text: Prompts.getWebSearchPrompt(),
                            },
                        ],
                    },
                    temperature: CONFIG.temperature.extraction,
                    tools: [
                        {
                            googleSearch: {},
                        },
                    ],
                },
            },
            undefined,
            'Investigador Web'
        );

        return {
            text: normalizeText(response.text),
            sources: extractGroundingSources(response),
        };
    } catch (error) {
        console.error('Error en investigación web:', error);
        throw new Error('La IA no pudo completar la investigación web.');
    }
}

// ============================================================================
// TRANSLATION
// ============================================================================

export async function translateText(
    textToTranslate: string
): Promise<string> {
    const text = normalizeText(textToTranslate);
    if (!text) {
        return '';
    }

    const safeText = clampText(
        text,
        CONFIG.limits.maxTranslationChars
    );

    try {
        const response = await generateContentWithRetry(
            {
                model: CONFIG.models.primary,
                contents: [
                    'Traduce al español el siguiente texto.',
                    'Conserva nombres propios, números, fechas y referencias jurídicas.',
                    'No agregues explicaciones adicionales.',
                    '',
                    'TEXTO:',
                    safeText,
                ].join('\n'),
                config: {
                    temperature: CONFIG.temperature.deterministic,
                },
            },
            undefined,
            'Traductor'
        );

        return normalizeText(response.text);
    } catch (error) {
        console.error('Error de traducción:', error);
        throw new Error('La IA no pudo traducir el texto.');
    }
}

// ============================================================================
// ARGUMENT ANALYSIS
// ============================================================================

export const stressTestArgument = async (
    userArgument: string,
    fullResult: FullAnalysisResult
): Promise<ArgumentAnalysis> => {
    const safeArgument = clampText(
        normalizeText(userArgument),
        50_000
    );

    if (!safeArgument) {
        throw new Error('El argumento a analizar está vacío.');
    }

    const systemInstruction = Prompts.getArgumentAnalysisPrompt(
        safeArgument,
        fullResult
    );

    return generateJson<ArgumentAnalysis>({
        agentName: 'Analista de Argumentos',
        schema: Prompts.ARGUMENT_ANALYSIS_SCHEMA,
        request: {
            model: CONFIG.models.primary,
            contents:
                'Analiza el argumento proporcionado siguiendo estrictamente las instrucciones y el contexto del expediente.',
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: systemInstruction,
                        },
                    ],
                },
                temperature: CONFIG.temperature.legalAnalysis,
                responseMimeType: 'application/json',
                responseSchema: Prompts.ARGUMENT_ANALYSIS_SCHEMA,
            },
        },
    });
};

export const stressTestDraft = async (
    draftText: string,
    fullResult: FullAnalysisResult
): Promise<ArgumentAnalysis> => {
    const safeDraft = clampText(
        normalizeText(draftText),
        CONFIG.limits.maxDraftChars
    );

    if (!safeDraft) {
        throw new Error('El borrador a analizar está vacío.');
    }

    const systemInstruction = Prompts.getStressTestDraftPrompt(
        safeDraft,
        fullResult
    );

    return generateJson<ArgumentAnalysis>({
        agentName: 'Magistrado de IA (Stress Test)',
        schema: Prompts.ARGUMENT_ANALYSIS_SCHEMA,
        request: {
            model: CONFIG.models.primary,
            contents:
                'Realiza el stress test del borrador conforme a las instrucciones y al contexto del expediente.',
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: systemInstruction,
                        },
                    ],
                },
                temperature: CONFIG.temperature.legalAnalysis,
                responseMimeType: 'application/json',
                responseSchema: Prompts.ARGUMENT_ANALYSIS_SCHEMA,
            },
        },
    });
};

// ============================================================================
// STRATEGIC DRAFTING
// ============================================================================

export const generateStrategicDraft = async (
    report: AnalysisReport,
    personality: AIPersonality,
    documentType: CaseDocumentType,
    additionalConsiderations?: string
): Promise<string> => {
    return generateDraft(
        Prompts.getDraftingPrompt(
            report,
            personality,
            documentType,
            additionalConsiderations
        ),
        'Redacta el borrador estratégico siguiendo estrictamente las instrucciones suministradas.',
        'Redactor Legal'
    );
};

export const refineDraft = async (
    report: AnalysisReport,
    initialDraft: string,
    stressTestResult: ArgumentAnalysis,
    personality: AIPersonality,
    documentType: CaseDocumentType
): Promise<string> => {
    return generateDraft(
        Prompts.getRefinementPrompt(
            report,
            clampText(initialDraft, CONFIG.limits.maxDraftChars),
            stressTestResult,
            personality,
            documentType
        ),
        'Genera el documento final mejorado incorporando las correcciones justificadas por el stress test.',
        'Editor Legal Senior'
    );
};

// ============================================================================
// CLIENT SUMMARY
// ============================================================================

export const generateClientSummary = async (
    report: AnalysisReport
): Promise<string> => {
    const result = await generateJson<{
        summary?: string;
    }>({
        agentName: 'Abogado Comunicador',
        schema: Prompts.CLIENT_SUMMARY_SCHEMA,
        request: {
            model: CONFIG.models.primary,
            contents: 'Genera el resumen ejecutivo para el cliente.',
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: Prompts.getClientSummaryPrompt(report),
                        },
                    ],
                },
                temperature: CONFIG.temperature.drafting,
                responseMimeType: 'application/json',
                responseSchema: Prompts.CLIENT_SUMMARY_SCHEMA,
            },
        },
    });

    return (
        normalizeText(result.summary) ||
        'No fue posible generar el resumen ejecutivo.'
    );
};

// ============================================================================
// LEGAL ACTIONS
// ============================================================================

export const proposeLegalActions = async (
    narrative: string
): Promise<LegalActionProposal[]> => {
    const safeNarrative = clampText(
        normalizeText(narrative),
        CONFIG.limits.maxNarrativeChars
    );

    if (!safeNarrative) {
        throw new Error('La narración de hechos está vacía.');
    }

    const result = await generateJson<{
        propuestas?: LegalActionProposal[];
    }>({
        agentName: 'Estratega Legal',
        schema: Prompts.LEGAL_ACTION_PROPOSAL_SCHEMA,
        request: {
            model: CONFIG.models.primary,
            contents:
                'Genera las propuestas de acciones legales basándote exclusivamente en la narración y las instrucciones.',
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: Prompts.getLegalActionProposalPrompt(
                                safeNarrative
                            ),
                        },
                    ],
                },
                temperature: CONFIG.temperature.drafting,
                responseMimeType: 'application/json',
                responseSchema: Prompts.LEGAL_ACTION_PROPOSAL_SCHEMA,
            },
        },
    });

    return Array.isArray(result.propuestas) ? result.propuestas : [];
};

// ============================================================================
// COMPARATIVE ANALYSIS
// ============================================================================

export const performComparativeAnalysis = async (
    documentAText: string,
    documentBText: string
): Promise<ComparativeAnalysisReport> => {
    const documentA = clampText(
        normalizeText(documentAText),
        CONFIG.limits.maxComparisonChars / 2
    );

    const documentB = clampText(
        normalizeText(documentBText),
        CONFIG.limits.maxComparisonChars / 2
    );

    if (!documentA || !documentB) {
        throw new Error(
            'Ambos documentos son necesarios para el análisis comparativo.'
        );
    }

    return generateJson<ComparativeAnalysisReport>({
        agentName: 'Auditor Comparativo',
        schema: Prompts.COMPARATIVE_ANALYSIS_SCHEMA,
        request: {
            model: CONFIG.models.primary,
            contents:
                'Realiza el análisis comparativo de ambos documentos conforme a las instrucciones.',
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: Prompts.getComparativeAnalysisPrompt(
                                documentA,
                                documentB
                            ),
                        },
                    ],
                },
                temperature: CONFIG.temperature.legalAnalysis,
                responseMimeType: 'application/json',
                responseSchema: Prompts.COMPARATIVE_ANALYSIS_SCHEMA,
            },
        },
    });
};

// ============================================================================
// INSIGHT LINKING
// ============================================================================

export const linkInsightToCriticalPoint = async (
    insightText: string,
    criticalPoints: CriticalPoint[]
): Promise<string> => {
    if (!normalizeText(insightText) || criticalPoints.length === 0) {
        return '';
    }

    const result = await generateJson<{
        linkedCriticalPointId?: string;
    }>({
        agentName: 'Clasificador de Insights',
        schema: Prompts.LINK_INSIGHT_SCHEMA,
        request: {
            model: CONFIG.models.primary,
            contents:
                'Determina el punto crítico más relevante para el insight proporcionado.',
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: Prompts.getLinkInsightPrompt(
                                insightText,
                                criticalPoints
                            ),
                        },
                    ],
                },
                temperature: CONFIG.temperature.deterministic,
                responseMimeType: 'application/json',
                responseSchema: Prompts.LINK_INSIGHT_SCHEMA,
            },
        },
    });

    return normalizeText(result.linkedCriticalPointId);
};

// ============================================================================
// AMENDMENT PROPOSAL & INTEGRATION
// ============================================================================

export const proposeAmendment = async (
    currentDraft: string,
    motion: RefinementMotion,
    report: AnalysisReport
): Promise<AmendmentProposal> => {
    return generateJson<AmendmentProposal>({
        agentName: 'Redactor Quirúrgico',
        schema: Prompts.PROPOSE_AMENDMENT_SCHEMA,
        request: {
            model: CONFIG.models.primary,
            contents:
                'Genera una propuesta de enmienda basada en la moción y el contexto del expediente.',
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: Prompts.getProposeAmendmentPrompt(
                                clampText(
                                    currentDraft,
                                    CONFIG.limits.maxDraftChars
                                ),
                                motion,
                                report
                            ),
                        },
                    ],
                },
                temperature: 0.4,
                responseMimeType: 'application/json',
                responseSchema: Prompts.PROPOSE_AMENDMENT_SCHEMA,
            },
        },
    });
};

export const integrateAmendment = async (
    currentDraft: string,
    amendment: AmendmentProposal,
    report: AnalysisReport
): Promise<string> => {
    const systemInstruction = Prompts.getIntegrateAmendmentPrompt(
        clampText(currentDraft, CONFIG.limits.maxDraftChars),
        amendment,
        report
    );

    return generateDraft(
        systemInstruction,
        'Integra la enmienda aceptada en el borrador actual preservando coherencia, hechos y estructura.',
        'Integrador de Enmiendas',
        0.3
    );
};

// ============================================================================
// TIMELINE EXTRACTION
// ============================================================================

export const extractTimelineEvents = async (
    fullText: string
): Promise<TimelineExtractionResponse> => {
    const safeText = clampText(
        normalizeText(fullText),
        CONFIG.limits.maxTimelineChars
    );

    if (!safeText) {
        throw new Error(
            'No existe texto suficiente para construir la línea de tiempo.'
        );
    }

    return generateJson<TimelineExtractionResponse>({
        agentName: 'Cronista Forense',
        schema: Prompts.TIMELINE_EXTRACTION_SCHEMA,
        request: {
            model: CONFIG.models.primary,
            contents:
                'Extrae exclusivamente los eventos cronológicos sustentados por los documentos.',
            config: {
                systemInstruction: {
                    role: 'system',
                    parts: [
                        {
                            text: Prompts.getTimelineExtractionPrompt(safeText),
                        },
                    ],
                },
                temperature: CONFIG.temperature.extraction,
                responseMimeType: 'application/json',
                responseSchema: Prompts.TIMELINE_EXTRACTION_SCHEMA,
            },
        },
    });
};
