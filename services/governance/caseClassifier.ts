/**
 * CASE CLASSIFIER & MODULE RESOLVER
 * LAGP V5
 *
 * Responsabilidades:
 * - Identificar país y jurisdicción.
 * - Clasificar rama del derecho mediante pesos de evidencia.
 * - Detectar señales procesales y etapa procesal.
 * - Extraer anclas temporales vinculadas a hechos, actos y plazos.
 * - Detectar información crítica faltante por especialidad.
 * - Resolver módulos de gobernanza aplicables con justificación dogmática.
 *
 * Diseño:
 * - Determinista y auditable.
 * - Sin efectos secundarios ni llamadas externas.
 */

import {
    resolveJurisdiction,
    resolveJurisdictionPack,
    type JurisdictionPack,
    type JurisdictionResolution,
} from './jurisdictionPacks';

import {
    createProvenanceGraph,
    type ProvenanceGraph,
    type EvidenceSource,
} from './evidenceGraph';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type LegalBranch =
    | 'ADMINISTRATIVO'
    | 'CONSTITUCIONAL'
    | 'CIVIL'
    | 'COMERCIAL'
    | 'LABORAL'
    | 'PENAL'
    | 'TRIBUTARIO'
    | 'OTRO';

export type ModuleStatus = 'APLICABLE' | 'NO_APLICABLE';

export interface TemporalAnchors {
    factsDate?: string;
    actOrRulingDate?: string;
    filingDeadlineDate?: string;
}

export interface GovernanceModule {
    moduleName: string;
    status: ModuleStatus;
    rationale: string;
}

export interface ClassificationMetadata {
    classifierVersion: string;
    catalogVersion: string;
    timestamp: string;
    heuristicConfidence: number;
}

export interface CaseClassificationResult {
    country: string;
    jurisdictionCode: string;
    legalBranch: LegalBranch;
    proceduralStage: string;
    competentAuthority: string;
    proceduralMeansOrAction: string;
    temporalAnchors: TemporalAnchors;
    applicableGovernanceModules: GovernanceModule[];
    missingCriticalInfo: string[];
    pack: JurisdictionPack;
    jurisdictionResolution?: JurisdictionResolution;
    evidenceGraph?: ProvenanceGraph;
    classificationMetadata?: ClassificationMetadata;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const DEFAULT_PROCEDURAL_STAGE =
    'Fase de Análisis Estratégico & Auditoría Forense';

const MAX_DATE_RESULTS = 12;

const YEAR_PATTERN = /(?:19|20)\d{2}/g;

const DATE_PATTERNS: RegExp[] = [
    // 31/12/2025
    /\b\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}\b/g,

    // 31-12-2025
    /\b\d{1,2}-\d{1,2}-(?:19|20)\d{2}\b/g,

    // 31 de diciembre de 2025
    /\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+(?:19|20)\d{2}\b/gi,

    // diciembre de 2025
    /\b[a-záéíóúñ]+\s+de\s+(?:19|20)\d{2}\b/gi
];

// ─────────────────────────────────────────────────────────────
// TEXT NORMALIZATION
// ─────────────────────────────────────────────────────────────

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function normalizeForSearch(value: string): string {
    return normalizeText(value);
}

// ─────────────────────────────────────────────────────────────
// KEYWORD MATCHING & RULES
// ─────────────────────────────────────────────────────────────

interface ClassificationRule {
    branch: LegalBranch;
    weight: number;
    keywords: readonly string[];
}

const LEGAL_BRANCH_RULES: readonly ClassificationRule[] = [
    {
        branch: 'PENAL',
        weight: 8,
        keywords: [
            'DELITO',
            'DELITOS',
            'FISCALIA',
            'FISCAL',
            'IMPUTACION',
            'IMPUTADO',
            'ACUSACION',
            'ACUSADO',
            'INVESTIGACION PENAL',
            'PROCESO PENAL',
            'JUZGADO PENAL',
            'CONDENA PENAL',
            'PENA',
            'PRESUNCION DE INOCENCIA',
            'VICTIMA PENAL'
        ]
    },

    {
        branch: 'LABORAL',
        weight: 8,
        keywords: [
            'CONTRATO DE TRABAJO',
            'RELACION LABORAL',
            'EMPLEADOR',
            'TRABAJADOR',
            'DESPIDO',
            'SALARIO',
            'PRESTACIONES SOCIALES',
            'PENSION',
            'ACOSO LABORAL',
            'JUZGADO LABORAL',
            'PROCESO LABORAL'
        ]
    },

    {
        branch: 'CONSTITUCIONAL',
        weight: 10,
        keywords: [
            'ACCION DE TUTELA',
            'TUTELA',
            'AMPARO',
            'DERECHOS FUNDAMENTALES',
            'HABEAS CORPUS',
            'HABEAS DATA',
            'DERECHO FUNDAMENTAL',
            'PROTECCION CONSTITUCIONAL',
            'JUEZ CONSTITUCIONAL'
        ]
    },

    {
        branch: 'TRIBUTARIO',
        weight: 8,
        keywords: [
            'TRIBUTARIO',
            'TRIBUTARIA',
            'IMPUESTO',
            'IMPUESTOS',
            'DIAN',
            'SAT',
            'RENTA',
            'IVA',
            'RETENCION EN LA FUENTE',
            'LIQUIDACION OFICIAL',
            'OBLIGACION TRIBUTARIA',
            'SANCION TRIBUTARIA'
        ]
    },

    {
        branch: 'COMERCIAL',
        weight: 7,
        keywords: [
            'DERECHO COMERCIAL',
            'CONTRATO MERCANTIL',
            'ACTO MERCANTIL',
            'SOCIEDAD COMERCIAL',
            'ACCION CAMBIARIA',
            'TITULO VALOR',
            'CHEQUE',
            'PAGARE',
            'LETRA DE CAMBIO',
            'CONCURSO MERCANTIL',
            'INSOLVENCIA EMPRESARIAL'
        ]
    },

    {
        branch: 'CIVIL',
        weight: 6,
        keywords: [
            'DERECHO CIVIL',
            'RESPONSABILIDAD CIVIL',
            'RESPONSABILIDAD CONTRACTUAL',
            'RESPONSABILIDAD EXTRACONTRACTUAL',
            'DOMINIO',
            'POSESION',
            'PROPIEDAD',
            'SUCESION',
            'SUCESORAL',
            'FAMILIA',
            'OBLIGACION CIVIL',
            'CONTRATO CIVIL',
            'JUZGADO CIVIL',
            'PROCESO CIVIL'
        ]
    },

    {
        branch: 'ADMINISTRATIVO',
        weight: 6,
        keywords: [
            'DERECHO ADMINISTRATIVO',
            'ACTO ADMINISTRATIVO',
            'ENTIDAD PUBLICA',
            'ENTIDAD ESTATAL',
            'ADMINISTRACION PUBLICA',
            'AUTORIDAD ADMINISTRATIVA',
            'CONTRATACION ESTATAL',
            'CONTRATO ESTATAL',
            'NULIDAD Y RESTABLECIMIENTO',
            'REPARACION DIRECTA',
            'MEDIO DE CONTROL',
            'CONSEJO DE ESTADO',
            'JUZGADO ADMINISTRATIVO',
            'TRIBUNAL ADMINISTRATIVO'
        ]
    }
];

// ─────────────────────────────────────────────────────────────
// BRANCH CLASSIFICATION
// ─────────────────────────────────────────────────────────────

function containsKeyword(
    text: string,
    keyword: string
): boolean {
    return text.includes(keyword);
}

function scoreLegalBranches(
    text: string
): Map<LegalBranch, number> {
    const scores = new Map<LegalBranch, number>();

    for (const rule of LEGAL_BRANCH_RULES) {
        let score = scores.get(rule.branch) ?? 0;

        for (const keyword of rule.keywords) {
            if (containsKeyword(text, keyword)) {
                score += rule.weight;
            }
        }

        scores.set(rule.branch, score);
    }

    return scores;
}

function classifyLegalBranch(
    text: string
): LegalBranch {
    const scores = scoreLegalBranches(text);

    let bestBranch: LegalBranch = 'OTRO';
    let bestScore = 0;

    for (const [branch, score] of scores) {
        if (score > bestScore) {
            bestBranch = branch;
            bestScore = score;
        }
    }

    return bestScore > 0 ? bestBranch : 'OTRO';
}

// ─────────────────────────────────────────────────────────────
// PROCEDURAL DETECTION
// ─────────────────────────────────────────────────────────────

interface ProceduralSignal {
    label: string;
    keywords: readonly string[];
}

const PROCEDURAL_SIGNALS: readonly ProceduralSignal[] = [
    {
        label: 'Tutela / amparo constitucional',
        keywords: [
            'TUTELA',
            'ACCION DE TUTELA',
            'AMPARO'
        ]
    },
    {
        label: 'Nulidad y restablecimiento del derecho',
        keywords: [
            'NULIDAD Y RESTABLECIMIENTO',
            'RESTABLECIMIENTO DEL DERECHO'
        ]
    },
    {
        label: 'Reparación directa',
        keywords: [
            'REPARACION DIRECTA'
        ]
    },
    {
        label: 'Controversia contractual estatal',
        keywords: [
            'CONTROVERSIA CONTRACTUAL',
            'CONTRATO ESTATAL'
        ]
    },
    {
        label: 'Proceso penal',
        keywords: [
            'PROCESO PENAL',
            'INVESTIGACION PENAL',
            'ACUSACION',
            'IMPUTACION'
        ]
    },
    {
        label: 'Proceso laboral',
        keywords: [
            'PROCESO LABORAL',
            'DEMANDA LABORAL',
            'JUZGADO LABORAL'
        ]
    },
    {
        label: 'Proceso civil',
        keywords: [
            'PROCESO CIVIL',
            'DEMANDA CIVIL',
            'JUZGADO CIVIL'
        ]
    }
];

function detectProceduralAction(
    text: string,
    pack: JurisdictionPack
): string {
    for (const signal of PROCEDURAL_SIGNALS) {
        if (signal.keywords.some(keyword => text.includes(keyword))) {
            return signal.label;
        }
    }

    return pack.keyTerminology.lawsuit;
}

// ─────────────────────────────────────────────────────────────
// PROCEDURAL STAGE
// ─────────────────────────────────────────────────────────────

const STAGE_RULES: readonly {
    label: string;
    keywords: readonly string[];
}[] = [
    {
        label: 'Etapa de presentación / radicación',
        keywords: [
            'RADICACION',
            'RADICADO',
            'PRESENTACION DE LA DEMANDA',
            'PRESENTO DEMANDA'
        ]
    },
    {
        label: 'Etapa de admisión',
        keywords: [
            'ADMISION',
            'AUTO ADMISORIO',
            'ADMITE LA DEMANDA'
        ]
    },
    {
        label: 'Etapa de contestación',
        keywords: [
            'CONTESTACION',
            'CONTESTA LA DEMANDA'
        ]
    },
    {
        label: 'Etapa probatoria',
        keywords: [
            'PRUEBAS',
            'ETAPA PROBATORIA',
            'DECRETO DE PRUEBAS',
            'PRACTICA DE PRUEBAS'
        ]
    },
    {
        label: 'Etapa de alegaciones',
        keywords: [
            'ALEGATOS',
            'ALEGACIONES',
            'ALEGATO DE CONCLUSION'
        ]
    },
    {
        label: 'Etapa de decisión',
        keywords: [
            'SENTENCIA',
            'FALLO',
            'DECISION',
            'RESUELVE'
        ]
    },
    {
        label: 'Etapa de impugnación / recursos',
        keywords: [
            'APELACION',
            'RECURSO DE APELACION',
            'RECURSO DE REPOSICION',
            'RECURSO',
            'IMPUGNACION'
        ]
    }
];

function detectProceduralStage(text: string): string {
    for (const rule of STAGE_RULES) {
        if (rule.keywords.some(keyword => text.includes(keyword))) {
            return rule.label;
        }
    }

    return DEFAULT_PROCEDURAL_STAGE;
}

// ─────────────────────────────────────────────────────────────
// DATE EXTRACTION
// ─────────────────────────────────────────────────────────────

function extractDates(text: string): string[] {
    const results = new Set<string>();

    for (const pattern of DATE_PATTERNS) {
        const matches = text.match(pattern) ?? [];

        for (const match of matches) {
            results.add(match.trim());

            if (results.size >= MAX_DATE_RESULTS) {
                return [...results];
            }
        }
    }

    return [...results];
}

function findDateNearKeywords(
    text: string,
    keywords: readonly string[]
): string | undefined {
    const lowerText = text.toLocaleLowerCase();

    for (const keyword of keywords) {
        const index = lowerText.indexOf(keyword.toLocaleLowerCase());

        if (index === -1) {
            continue;
        }

        const contextStart = Math.max(0, index - 120);
        const contextEnd = Math.min(text.length, index + keyword.length + 180);
        const context = text.slice(contextStart, contextEnd);
        const dates = extractDates(context);

        if (dates.length > 0) {
            return dates[0];
        }
    }

    return undefined;
}

function extractTemporalAnchors(originalText: string): TemporalAnchors {
    const text = normalizeForSearch(originalText);

    return {
        factsDate: findDateNearKeywords(
            text,
            [
                'HECHO',
                'HECHOS',
                'ACAECIMIENTO',
                'OCURRIO',
                'SUCEDIO'
            ]
        ),

        actOrRulingDate: findDateNearKeywords(
            text,
            [
                'ACTO ADMINISTRATIVO',
                'RESOLUCION',
                'SENTENCIA',
                'FALLO',
                'DECISION',
                'PROVIDENCIA'
            ]
        ),

        filingDeadlineDate: findDateNearKeywords(
            text,
            [
                'TERMINO',
                'PLAZO',
                'CADUCIDAD',
                'PRESCRIPCION',
                'VENCIMIENTO',
                'FECHA LIMITE'
            ]
        )
    };
}

// ─────────────────────────────────────────────────────────────
// MISSING INFORMATION
// ─────────────────────────────────────────────────────────────

function hasAny(
    text: string,
    values: readonly string[]
): boolean {
    return values.some(value => text.includes(value));
}

function detectMissingCriticalInfo(
    text: string,
    branch: LegalBranch
): string[] {
    const missing: string[] = [];

    // Temporal
    const hasDate =
        YEAR_PATTERN.test(text) ||
        extractDates(text).length > 0;

    YEAR_PATTERN.lastIndex = 0;

    if (!hasDate) {
        missing.push(
            'Fechas exactas de los hechos, notificación del acto, decisión o actuación relevante.'
        );
    }

    // Cuantía / Estimación económica
    if (
        ['CIVIL', 'COMERCIAL', 'LABORAL', 'TRIBUTARIO', 'ADMINISTRATIVO'].includes(branch) &&
        !hasAny(text, [
            'CUANTIA',
            'VALOR',
            'MONTO',
            'CAPITAL',
            '$',
            'PESOS'
        ])
    ) {
        missing.push(
            'Determinación de la cuantía o estimación económica del litigio, cuando resulte jurídicamente relevante.'
        );
    }

    // Sujetos procesales
    if (
        !hasAny(text, [
            'DEMANDANTE',
            'ACTOR',
            'ACCIONANTE',
            'DEMANDADO',
            'ACCIONADO',
            'IMPUTADO',
            'ACUSADO',
            'TRABAJADOR',
            'EMPLEADOR',
            'ENTIDAD'
        ])
    ) {
        missing.push(
            'Identificación clara de las partes, sujetos procesales o autoridad involucrada.'
        );
    }

    // Administrativo
    if (branch === 'ADMINISTRATIVO') {
        if (
            !hasAny(text, [
                'ACTO ADMINISTRATIVO',
                'RESOLUCION',
                'DECRETO',
                'CIRCULAR',
                'OFICIO'
            ])
        ) {
            missing.push(
                'Identificación del acto administrativo cuestionado y de su contenido decisorio.'
            );
        }

        if (
            !hasAny(text, [
                'NOTIFICACION',
                'NOTIFICADO',
                'PUBLICACION',
                'EJECUTORIA'
            ])
        ) {
            missing.push(
                'Constancia de notificación, publicación o ejecutoria del acto, según corresponda.'
            );
        }
    }

    // Penal
    if (branch === 'PENAL') {
        if (
            !hasAny(text, [
                'HECHO',
                'HECHOS',
                'CONDUCTA',
                'DELITO'
            ])
        ) {
            missing.push(
                'Descripción concreta de la conducta investigada y de sus circunstancias relevantes.'
            );
        }

        if (
            !hasAny(text, [
                'PRUEBA',
                'EVIDENCIA',
                'ELEMENTO MATERIAL',
                'TESTIGO'
            ])
        ) {
            missing.push(
                'Identificación de los principales elementos materiales, evidencias o fuentes de prueba.'
            );
        }
    }

    // Laboral
    if (branch === 'LABORAL') {
        if (
            !hasAny(text, [
                'CONTRATO DE TRABAJO',
                'RELACION LABORAL',
                'VINCULO LABORAL'
            ])
        ) {
            missing.push(
                'Determinación del vínculo laboral, modalidad contractual y período de prestación del servicio.'
            );
        }
    }

    // Constitucional
    if (branch === 'CONSTITUCIONAL') {
        if (
            !hasAny(text, [
                'DERECHO FUNDAMENTAL',
                'DERECHOS FUNDAMENTALES',
                'DERECHO CONSTITUCIONAL'
            ])
        ) {
            missing.push(
                'Identificación precisa del derecho fundamental presuntamente vulnerado o amenazado.'
            );
        }
    }

    return missing;
}

// ─────────────────────────────────────────────────────────────
// GOVERNANCE MODULES
// ─────────────────────────────────────────────────────────────

interface ModuleRule {
    moduleName: string;
    appliesTo?: readonly LegalBranch[];
    excludes?: readonly LegalBranch[];
    rationale: string;
}

const GOVERNANCE_MODULE_RULES: readonly ModuleRule[] = [
    {
        moduleName: 'Auditoría de Competencia Funcional/Territorial',
        rationale:
            'Control transversal para verificar competencia funcional, territorial y material y reducir riesgos de nulidad o remisión.'
    },

    {
        moduleName: 'Control de Caducidad y Prescripción',
        rationale:
            'Verificación del régimen temporal aplicable al medio de control, acción, pretensión o derecho sustancial.'
    },

    {
        moduleName: 'Separación de Efectos (Anulatorio vs Restitutorio)',
        appliesTo: [
            'ADMINISTRATIVO',
            'CIVIL',
            'LABORAL'
        ],
        rationale:
            'Permite separar la pretensión de eliminación del acto o situación jurídica de las consecuencias restitutorias o indemnizatorias que requieran fundamento y prueba autónomos.'
    },

    {
        moduleName: 'Test de Analogía Jurisprudencial y Precedente Vinculante',
        rationale:
            'Evalúa similitud fáctica, cuestión jurídica, ratio decidendi y fuerza vinculante de los precedentes invocados.'
    },

    {
        moduleName: 'Steelman Adversarial y Prueba de Falsación',
        rationale:
            'Exige construir la versión más fuerte de la tesis contraria y someter la hipótesis propia a intentos explícitos de falsación.'
    },

    {
        moduleName: 'Trazabilidad Documental y Cadena de Custodia',
        rationale:
            'Exige trazabilidad entre cada afirmación fáctica relevante y su fuente documental o probatoria.'
    }
];

function resolveGovernanceModules(branch: LegalBranch): GovernanceModule[] {
    return GOVERNANCE_MODULE_RULES.map(rule => {
        const applies =
            (!rule.appliesTo || rule.appliesTo.includes(branch)) &&
            (!rule.excludes || !rule.excludes.includes(branch));

        return {
            moduleName: rule.moduleName,
            status: applies ? 'APLICABLE' : 'NO_APLICABLE',
            rationale: applies
                ? rule.rationale
                : `No aplicable de forma prioritaria a la rama ${branch}.`
        };
    });
}

function resolveCompetentAuthority(
    pack: JurisdictionPack
): string {
    const authority = pack.courtHierarchy.firstInstanceCourts;
    return authority || 'Autoridad competente por determinar';
}

// ─────────────────────────────────────────────────────────────
// MAIN CLASSIFIER
// ─────────────────────────────────────────────────────────────

export const classifyCaseContext = (
    documentText: string
): CaseClassificationResult => {
    const originalText = String(documentText ?? '').trim();
    const normalizedText = normalizeForSearch(originalText);

    const resolution = resolveJurisdiction(originalText);
    const pack = resolution.pack;
    const legalBranch = classifyLegalBranch(normalizedText);
    const proceduralStage = detectProceduralStage(normalizedText);
    const proceduralMeansOrAction = detectProceduralAction(normalizedText, pack);
    const temporalAnchors = extractTemporalAnchors(originalText);
    const missingCriticalInfo = detectMissingCriticalInfo(normalizedText, legalBranch);
    const applicableGovernanceModules = resolveGovernanceModules(legalBranch);
    const competentAuthority = resolveCompetentAuthority(pack);

    // Semilla inicial y no-bloqueante del Grafo de Provenance
    const initialSources: EvidenceSource[] = [
        {
            id: 'SRC-CASE-DOCUMENT-PRIMARY',
            type: 'CASE_DOCUMENT',
            title: 'Expediente Documental Principal',
            jurisdictionCode: resolution.code,
            isCorpusDocument: true,
            excerpt: originalText.slice(0, 300) + (originalText.length > 300 ? '...' : ''),
        },
    ];

    if (pack.proceduralCodes.administrative) {
        initialSources.push({
            id: `SRC-NORM-${pack.code}-ADM`,
            type: 'NORMATIVE_SOURCE',
            title: pack.proceduralCodes.administrative,
            jurisdictionCode: pack.code,
            isCorpusDocument: false,
        });
    }

    const evidenceGraph = createProvenanceGraph({
        initialSources,
    });

    return {
        country: pack.country,
        jurisdictionCode: pack.code,
        legalBranch,
        proceduralStage,
        competentAuthority,
        proceduralMeansOrAction,
        temporalAnchors,
        applicableGovernanceModules,
        missingCriticalInfo,
        evidenceGraph,
        pack,
        jurisdictionResolution: resolution,
        classificationMetadata: {
            classifierVersion: resolution.engineVersion,
            catalogVersion: resolution.catalogVersion,
            timestamp: new Date().toISOString(),
            heuristicConfidence: resolution.heuristicConfidence,
        },
    };
};
