/**
 * EX LEGE SOVEREIGN - EVIDENCE & PROVENANCE GRAPH ENGINE
 * 
 * Capa ontológica y motor de auditabilidad forense para trazabilidad de claims
 * jurídicos, fuentes probatorias y verificación de citas.
 */

export type LegalClaimType =
    | 'FACT'
    | 'LAW'
    | 'PRECEDENT'
    | 'INFERENCE'
    | 'ASSUMPTION'
    | 'UNKNOWN';

export type ClaimSupportLevel =
    | 'DIRECT'
    | 'INDIRECT'
    | 'PARTIAL'
    | 'CONTRADICTED'
    | 'UNSUPPORTED';

export type EvidenceSourceType =
    | 'CASE_DOCUMENT'
    | 'NORMATIVE_SOURCE'
    | 'JUDICIAL_DECISION'
    | 'EXTERNAL_SOURCE'
    | 'MODEL_OUTPUT';

export type ClaimRelationType =
    | 'SUPPORTS'
    | 'PARTIALLY_SUPPORTS'
    | 'CONTRADICTS'
    | 'CONTEXTUALIZES';

export type VerificationResult =
    | 'VERIFIED'
    | 'PARTIAL'
    | 'UNSUPPORTED'
    | 'INVALID_SOURCE'
    | 'INVALID_LOCATOR'
    | 'JURISDICTION_MISMATCH'
    | 'NOT_VERIFIABLE';

export interface EvidenceSource {
    id: string;
    type: EvidenceSourceType;
    title?: string;
    documentId?: string;
    page?: number;
    folio?: string;
    locator?: string;
    excerpt?: string;
    jurisdictionCode?: string;
    isCorpusDocument?: boolean;
}

export interface ClaimEvidenceLink {
    claimId: string;
    sourceId: string;
    relation: ClaimRelationType;
    locator?: string;
    verified: boolean;
    verificationResult?: VerificationResult;
    notes?: string;
}

export interface LegalClaim {
    id: string;
    type: LegalClaimType;
    text: string;
    sourceIds: string[];
    links?: ClaimEvidenceLink[];
    supportLevel: ClaimSupportLevel;
    verified: boolean;
    verificationResult?: VerificationResult;
    verificationDetails?: string;
}

export interface ProvenanceGraph {
    id: string;
    claims: LegalClaim[];
    sources: EvidenceSource[];
    links: ClaimEvidenceLink[];
    createdAt: string;
    engineVersion: string;
    metadata?: Record<string, unknown>;
}

export const PROVENANCE_ENGINE_VERSION = '1.0.0-provenance';

/**
 * Factoría pura para crear un grafo de provenance vacío o inicializado.
 */
export function createProvenanceGraph(params?: {
    id?: string;
    initialSources?: EvidenceSource[];
    initialClaims?: LegalClaim[];
}): ProvenanceGraph {
    return {
        id: params?.id || `GRF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        claims: params?.initialClaims || [],
        sources: params?.initialSources || [],
        links: [],
        createdAt: new Date().toISOString(),
        engineVersion: PROVENANCE_ENGINE_VERSION,
    };
}

/**
 * Constructor inmutable y fluido de grafos de evidencia probatoria.
 */
export class EvidenceGraphBuilder {
    private graph: ProvenanceGraph;

    constructor(initialGraph?: ProvenanceGraph) {
        this.graph = initialGraph
            ? { ...initialGraph, claims: [...initialGraph.claims], sources: [...initialGraph.sources], links: [...initialGraph.links] }
            : createProvenanceGraph();
    }

    public addSource(source: EvidenceSource): this {
        if (!this.graph.sources.some(s => s.id === source.id)) {
            this.graph.sources.push(source);
        }
        return this;
    }

    public addClaim(claim: LegalClaim): this {
        if (!this.graph.claims.some(c => c.id === claim.id)) {
            this.graph.claims.push(claim);
        }
        return this;
    }

    public linkClaimToSource(link: ClaimEvidenceLink): this {
        this.graph.links.push(link);
        const claim = this.graph.claims.find(c => c.id === link.claimId);
        if (claim) {
            if (!claim.sourceIds.includes(link.sourceId)) {
                claim.sourceIds.push(link.sourceId);
            }
            claim.links = claim.links || [];
            claim.links.push(link);
        }
        return this;
    }

    public build(): ProvenanceGraph {
        return {
            ...this.graph,
            claims: [...this.graph.claims],
            sources: [...this.graph.sources],
            links: [...this.graph.links],
        };
    }
}

/**
 * Verificador determinista objetivo de citas y fuentes.
 * No evalúa la verdad material ni el mérito probatorio, sino la existencia objetiva,
 * coincidencia jurisdiccional y validez de los localizadores.
 */
export class EvidenceVerifier {
    public static verifyLink(
        link: ClaimEvidenceLink,
        source: EvidenceSource | undefined,
        options?: {
            currentJurisdiction?: string;
            maxAvailablePages?: number;
            corpusText?: string;
        }
    ): VerificationResult {
        if (!source) {
            return 'INVALID_SOURCE';
        }

        // 1. Verificación de jurisdicción
        if (
            options?.currentJurisdiction &&
            source.jurisdictionCode &&
            options.currentJurisdiction !== 'GENERIC' &&
            source.jurisdictionCode !== 'GENERIC' &&
            source.jurisdictionCode !== options.currentJurisdiction
        ) {
            return 'JURISDICTION_MISMATCH';
        }

        // 2. Verificación de localizador físico (páginas/folios)
        if (options?.maxAvailablePages && source.page) {
            if (source.page <= 0 || source.page > options.maxAvailablePages) {
                return 'INVALID_LOCATOR';
            }
        }

        // 3. Verificación de contenido en el corpus (si se proveyó un excerpt)
        if (source.excerpt && options?.corpusText) {
            const normalizedCorpus = options.corpusText.toLowerCase().replace(/\s+/g, ' ');
            const normalizedExcerpt = source.excerpt.toLowerCase().replace(/\s+/g, ' ');
            if (!normalizedCorpus.includes(normalizedExcerpt)) {
                return 'PARTIAL';
            }
        }

        return 'VERIFIED';
    }

    public static verifyGraph(
        graph: ProvenanceGraph,
        context?: {
            currentJurisdiction?: string;
            maxAvailablePages?: number;
            corpusText?: string;
        }
    ): ProvenanceGraph {
        const sourceMap = new Map<string, EvidenceSource>(
            graph.sources.map(s => [s.id, s])
        );

        const verifiedLinks = graph.links.map(link => {
            const source = sourceMap.get(link.sourceId);
            const result = this.verifyLink(link, source, context);
            return {
                ...link,
                verified: result === 'VERIFIED',
                verificationResult: result,
            };
        });

        const verifiedClaims = graph.claims.map(claim => {
            const claimLinks = verifiedLinks.filter(l => l.claimId === claim.id);
            const hasLinks = claimLinks.length > 0;
            const allVerified = hasLinks && claimLinks.every(l => l.verified);
            const hasInvalidSource = claimLinks.some(l => l.verificationResult === 'INVALID_SOURCE');
            const hasJurisdictionMismatch = claimLinks.some(l => l.verificationResult === 'JURISDICTION_MISMATCH');
            const hasInvalidLocator = claimLinks.some(l => l.verificationResult === 'INVALID_LOCATOR');

            let overallResult: VerificationResult = 'NOT_VERIFIABLE';
            if (!hasLinks) {
                overallResult = claim.supportLevel === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'NOT_VERIFIABLE';
            } else if (hasJurisdictionMismatch) {
                overallResult = 'JURISDICTION_MISMATCH';
            } else if (hasInvalidSource) {
                overallResult = 'INVALID_SOURCE';
            } else if (hasInvalidLocator) {
                overallResult = 'INVALID_LOCATOR';
            } else if (allVerified) {
                overallResult = 'VERIFIED';
            } else {
                overallResult = 'PARTIAL';
            }

            return {
                ...claim,
                links: claimLinks,
                verified: allVerified,
                verificationResult: overallResult,
                verificationDetails: `Resultado objetivo: ${overallResult} (${claimLinks.length} enlaces analizados)`,
            };
        });

        return {
            ...graph,
            claims: verifiedClaims,
            links: verifiedLinks,
        };
    }
}
