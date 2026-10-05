import { GoogleGenAI, Type } from '@google/genai';
import type { AnalysisProgress } from '../../types';
import { parseJsonResponse } from '../geminiService';

/* ==========================================================================
 * Configuration
 * ========================================================================== */

const MODEL_GENERATOR = 'gemini-3.7-flash';
const MODEL_CRITIC = 'gemini-3.7-flash';

const APPROVAL_SCORE = 95;
const DEFAULT_MAX_ITERATIONS = 3;

const MAX_CASE_SUMMARY_FOR_CRITIC = 4_000;
const MAX_CASE_SUMMARY_FOR_WRITER = 3_000;

const MAX_CRITICAL_WEAKNESSES = 3;
const MAX_REQUIRED_REMEDIATIONS = 3;

/**
 * Temperaturas bajas para tareas jurídicas estructuradas.
 * El auditor debe ser especialmente determinista.
 */
const CRITIC_TEMPERATURE = 0.1;
const GENERATOR_TEMPERATURE = 0.2;

/* ==========================================================================
 * Types
 * ========================================================================== */

export type AuditStatus = 'APPROVED' | 'REJECTED';

export type AdmissibilityRisk = 'BAJO' | 'MEDIO' | 'ALTO';

export interface AuditEvaluation {
    status: AuditStatus;
    score: number;
    critique: string;
    identifiedWeaknesses: string[];
    requiredRemediations: string[];
    admissibilityRisk: AdmissibilityRisk;
}

export interface RefinementIteration {
    iterationIndex: number;
    draft: string;
    evaluation: AuditEvaluation;
    timestamp: number;
}

export interface RefinementLoopResult {
    finalDraft: string;
    finalScore: number;
    approved: boolean;
    totalIterations: number;
    history: RefinementIteration[];
    summary: string;
}

/* ==========================================================================
 * Gemini Schema
 * ========================================================================== */

const CRITIC_RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        status: {
            type: Type.STRING,
            enum: ['APPROVED', 'REJECTED'],
            description:
                'Estado preliminar de la auditoría. El servidor determinará el estado definitivo.',
        },
        score: {
            type: Type.NUMBER,
            description:
                'Puntuación de rigor jurídico entre 0 y 100.',
        },
        critique: {
            type: Type.STRING,
            description:
                'Análisis técnico de las deficiencias, inconsistencias y riesgos del borrador.',
        },
        identifiedWeaknesses: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
            },
            description:
                'Debilidades concretas y verificables detectadas en el borrador.',
        },
        requiredRemediations: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
            },
            description:
                'Correcciones concretas que el redactor debe implementar.',
        },
        admissibilityRisk: {
            type: Type.STRING,
            enum: ['BAJO', 'MEDIO', 'ALTO'],
            description:
                'Riesgo estimado de inadmisión, rechazo o vulnerabilidad procesal.',
        },
    },
    required: [
        'status',
        'score',
        'critique',
        'identifiedWeaknesses',
        'requiredRemediations',
        'admissibilityRisk',
    ],
};

/* ==========================================================================
 * Helpers
 * ========================================================================== */

const EMPTY_EVALUATION: AuditEvaluation = {
    status: 'REJECTED',
    score: 0,
    critique: '',
    identifiedWeaknesses: [],
    requiredRemediations: [],
    admissibilityRisk: 'ALTO',
};

function clampScore(score: unknown): number {
    const numericScore =
        typeof score === 'number'
            ? score
            : Number(score);

    if (!Number.isFinite(numericScore)) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(0, Math.round(numericScore)),
    );
}

function normalizeStringArray(values: unknown): string[] {
    if (!Array.isArray(values)) {
        return [];
    }

    return [
        ...new Set(
            values
                .filter(
                    (value): value is string =>
                        typeof value === 'string',
                )
                .map(value => value.trim())
                .filter(Boolean),
        ),
    ];
}

/**
 * El servidor determina el estado final como autoridad de verdad.
 * No confiamos ciegamente en evaluation.status porque el modelo puede devolver
 * desajustes entre score numérico y estado, o aprobar un borrador con riesgo procesal ALTO.
 */
function normalizeEvaluation(raw: AuditEvaluation): AuditEvaluation {
    const score = clampScore(raw.score);

    const identifiedWeaknesses = normalizeStringArray(raw.identifiedWeaknesses);
    const requiredRemediations = normalizeStringArray(raw.requiredRemediations);

    const admissibilityRisk: AdmissibilityRisk =
        raw.admissibilityRisk === 'BAJO' ||
        raw.admissibilityRisk === 'MEDIO' ||
        raw.admissibilityRisk === 'ALTO'
            ? raw.admissibilityRisk
            : 'ALTO';

    // Una evaluación con riesgo ALTO de inadmisión no puede aprobarse automáticamente
    const hasCriticalRisk = admissibilityRisk === 'ALTO';

    const status: AuditStatus =
        score >= APPROVAL_SCORE && !hasCriticalRisk
            ? 'APPROVED'
            : 'REJECTED';

    return {
        status,
        score,
        critique:
            typeof raw.critique === 'string'
                ? raw.critique.trim()
                : '',
        identifiedWeaknesses,
        requiredRemediations,
        admissibilityRisk,
    };
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength)}\n\n[CONTENIDO TRUNCADO]`;
}

/* ==========================================================================
 * Service
 * ========================================================================== */

export class RefinementLoopService {
    private readonly ai: GoogleGenAI;

    constructor(apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY) {
        if (!apiKey) {
            throw new Error(
                'Gemini API key not configured. Set API_KEY or GEMINI_API_KEY.',
            );
        }

        this.ai = new GoogleGenAI({
            apiKey,
        });
    }

    /* ----------------------------------------------------------------------
     * Progress
     * ---------------------------------------------------------------------- */

    private emitProgress(
        onProgress: ((p: AnalysisProgress) => void) | undefined,
        progress: AnalysisProgress,
    ): void {
        try {
            onProgress?.(progress);
        } catch {
            // Un error en el callback de UI no debe abortar la inferencia
        }
    }

    /* ----------------------------------------------------------------------
     * Critic
     * ---------------------------------------------------------------------- */

    private async evaluateDraft(
        draftText: string,
        caseSummary: string,
        onProgress?: (p: AnalysisProgress) => void,
        iterationNumber = 1,
    ): Promise<AuditEvaluation> {
        this.emitProgress(onProgress, {
            log:
                `[Magistrado Crítico - Iteración ${iterationNumber}] ` +
                'Auditando hechos, normas, silogismo, congruencia y riesgos procesales...',
            agentId: 'critic',
            status: 'TRABAJANDO',
        });

        const prompt = `
OBJETIVO
Auditar técnicamente el borrador procesal utilizando exclusivamente
la información disponible en el contexto proporcionado.

CRITERIOS OBLIGATORIOS

1. HECHOS
- Diferencia hechos acreditados de afirmaciones, inferencias o hipótesis.
- No atribuyas al expediente hechos que no estén respaldados por el contexto.
- Señala cualquier afirmación fáctica no sustentada.

2. PRETENSIONES
- Verifica separación entre pretensión principal y subsidiarias.
- Comprueba congruencia entre hechos, pretensiones y conclusiones.

3. SILOGISMO JURÍDICO
Analiza cada argumento relevante como:
Hecho → Norma → Inferencia → Conclusión.

4. FUNDAMENTACIÓN
- Detecta normas ausentes, incorrectas o insuficientemente conectadas con los hechos.
- Identifica saltos inferenciales.

5. RIESGO PROCESAL
Revisa especialmente:
- caducidad;
- prescripción cuando resulte pertinente;
- legitimación;
- competencia;
- excepciones previas;
- requisitos formales;
- congruencia;
- suficiencia probatoria.

6. EVIDENCIA
No inventes pruebas, documentos, fechas, artículos, jurisprudencia
ni hechos que no estén presentes en el contexto.

REGLA DE APROBACIÓN

El estado APPROVED solo puede corresponder a un borrador que:
- alcance ${APPROVAL_SCORE}/100 o más;
- no presente inconsistencias graves;
- no presente riesgo procesal ALTO;
- mantenga coherencia entre hechos, pretensiones, normas y conclusiones.

CONTEXTO DEL CASO
${truncate(caseSummary, MAX_CASE_SUMMARY_FOR_CRITIC)}

BORRADOR A AUDITAR
${draftText}
`.trim();

        const response = await this.ai.models.generateContent({
            model: MODEL_CRITIC,
            contents: prompt,
            config: {
                systemInstruction:
                    'Actúas como auditor jurídico adversarial. ' +
                    'Debes identificar vulnerabilidades reales y verificables. ' +
                    'No inventes información jurídica ni fáctica.',
                temperature: CRITIC_TEMPERATURE,
                responseMimeType: 'application/json',
                responseSchema: CRITIC_RESPONSE_SCHEMA,
            },
        });

        if (!response.text) {
            throw new Error('El modelo auditor devolvió una respuesta vacía.');
        }

        const parsed = parseJsonResponse<AuditEvaluation>(response.text);
        return normalizeEvaluation(parsed);
    }

    /* ----------------------------------------------------------------------
     * Writer
     * ---------------------------------------------------------------------- */

    private async generateImprovedDraft(
        currentDraft: string,
        evaluation: AuditEvaluation,
        caseSummary: string,
        onProgress?: (p: AnalysisProgress) => void,
        iterationNumber = 1,
    ): Promise<string> {
        this.emitProgress(onProgress, {
            log:
                `[Agente Litigante - Iteración ${iterationNumber}] ` +
                `Corrigiendo vulnerabilidades prioritarias ` +
                `(score actual: ${evaluation.score}/100)...`,
            agentId: 'writer',
            status: 'TRABAJANDO',
        });

        const weaknesses = evaluation.identifiedWeaknesses.slice(0, MAX_CRITICAL_WEAKNESSES);
        const remediations = evaluation.requiredRemediations.slice(0, MAX_REQUIRED_REMEDIATIONS);

        const weaknessesText =
            weaknesses.length > 0
                ? weaknesses.map((item, index) => `${index + 1}. ${item}`).join('\n')
                : 'No se identificaron debilidades específicas.';

        const remediationsText =
            remediations.length > 0
                ? remediations.map((item, index) => `${index + 1}. ${item}`).join('\n')
                : 'Revisar integralmente coherencia y suficiencia jurídica.';

        const prompt = `
OBJETIVO
Reescribir el borrador procesal corrigiendo las vulnerabilidades
identificadas por el auditor.

REGLA CENTRAL
No inventes hechos, pruebas, normas, artículos, fechas,
jurisprudencia ni documentos.

DICTAMEN DEL AUDITOR
${evaluation.critique}

DEBILIDADES PRIORITARIAS
${weaknessesText}

REMEDIACIONES OBLIGATORIAS
${remediationsText}

CONTEXTO FÁCTICO
${truncate(caseSummary, MAX_CASE_SUMMARY_FOR_WRITER)}

BORRADOR ACTUAL
${currentDraft}

REQUISITOS DE REESCRITURA

1. Conserva únicamente afirmaciones respaldadas por el expediente.
2. Corrige las debilidades señaladas.
3. Mantén separadas las pretensiones principal y subsidiarias.
4. Estructura los argumentos jurídicos como:
   Hecho → Norma → Inferencia → Conclusión.
5. No agregues doctrina o jurisprudencia ornamental.
6. No aumentes artificialmente la extensión.
7. Si existe una deficiencia que no puede subsanarse con la información
   disponible, formula el argumento de manera explícitamente condicionada
   en lugar de inventar datos.
8. Conserva la estructura procesal útil del documento original.
9. Prioriza precisión, trazabilidad probatoria y congruencia.
`.trim();

        const response = await this.ai.models.generateContent({
            model: MODEL_GENERATOR,
            contents: prompt,
            config: {
                systemInstruction:
                    'Actúas como redactor jurídico especializado. ' +
                    'Corrige únicamente problemas sustentados por el expediente. ' +
                    'La precisión y trazabilidad tienen prioridad sobre la retórica.',
                temperature: GENERATOR_TEMPERATURE,
            },
        });

        const improvedDraft = response.text?.trim();

        if (!improvedDraft) {
            throw new Error('El modelo redactor devolvió una respuesta vacía.');
        }

        return improvedDraft;
    }

    /* ----------------------------------------------------------------------
     * Main loop
     * ---------------------------------------------------------------------- */

    public async runReflectiveLoop(
        initialDraft: string,
        caseSummary: string,
        maxIterations = DEFAULT_MAX_ITERATIONS,
        onProgress?: (p: AnalysisProgress) => void,
    ): Promise<RefinementLoopResult> {
        const normalizedDraft = initialDraft?.trim();
        const normalizedSummary = caseSummary?.trim();

        if (!normalizedDraft) {
            throw new Error('initialDraft no puede estar vacío.');
        }

        if (!normalizedSummary) {
            throw new Error('caseSummary no puede estar vacío.');
        }

        const iterationLimit = Math.max(1, Math.floor(maxIterations));

        let currentDraft = normalizedDraft;
        let lastEvaluation = EMPTY_EVALUATION;

        const history: RefinementIteration[] = [];

        this.emitProgress(onProgress, {
            log:
                `[Bucle de Reflexión] Iniciando optimización iterativa ` +
                `(objetivo: ${APPROVAL_SCORE}/100, máximo: ${iterationLimit} iteraciones)...`,
            agentId: 'refiner',
            status: 'TRABAJANDO',
        });

        for (let iteration = 1; iteration <= iterationLimit; iteration++) {
            lastEvaluation = await this.evaluateDraft(
                currentDraft,
                normalizedSummary,
                onProgress,
                iteration,
            );

            history.push({
                iterationIndex: iteration,
                draft: currentDraft,
                evaluation: lastEvaluation,
                timestamp: Date.now(),
            });

            this.emitProgress(onProgress, {
                log:
                    `[Evaluación ${iteration}] ` +
                    `Resultado: ${lastEvaluation.status} | ` +
                    `Score: ${lastEvaluation.score}/100 | ` +
                    `Riesgo: ${lastEvaluation.admissibilityRisk}`,
                agentId: 'critic',
                status:
                    lastEvaluation.status === 'APPROVED'
                        ? 'COMPLETADO'
                        : 'TRABAJANDO',
            });

            // Punto de salida por aprobación del servidor
            if (lastEvaluation.status === 'APPROVED') {
                break;
            }

            // Si es la última iteración, no tiene sentido generar otro borrador
            if (iteration >= iterationLimit) {
                break;
            }

            const previousDraft = currentDraft;

            currentDraft = await this.generateImprovedDraft(
                previousDraft,
                lastEvaluation,
                normalizedSummary,
                onProgress,
                iteration + 1,
            );

            // Protección contra estancamiento / no-op
            if (currentDraft.trim() === previousDraft.trim()) {
                this.emitProgress(onProgress, {
                    log:
                        `[Iteración ${iteration}] ` +
                        'El redactor no produjo cambios sustanciales; se detiene la optimización.',
                    agentId: 'refiner',
                    status: 'COMPLETADO',
                });
                break;
            }
        }

        const approved = lastEvaluation.status === 'APPROVED';

        const summary = approved
            ? `Borrador aprobado tras ${history.length} ` +
              `iteración(es). Score final: ${lastEvaluation.score}/100.`
            : `Proceso finalizado tras ${history.length} ` +
              `iteración(es). Score final: ${lastEvaluation.score}/100. ` +
              `El borrador requiere revisión adicional.`;

        this.emitProgress(onProgress, {
            log: `[Bucle de Reflexión] ${summary}`,
            agentId: 'refiner',
            status: 'COMPLETADO',
        });

        return {
            finalDraft: currentDraft,
            finalScore: lastEvaluation.score,
            approved,
            totalIterations: history.length,
            history,
            summary,
        };
    }
}

export const refinementLoopService = new RefinementLoopService();
