/**
 * SkillOpt: Agent Skills as Trainable Parameters (Microsoft Research Methodology)
 * Tipos y definiciones de dominio para la optimización de habilidades de agentes en el espacio de texto.
 */

export type SkillId = 
    | 'ACP_EVIDENTIARY_INCONSISTENCY'
    | 'FRACTURE_POINT_ENGINE'
    | 'JURISPRUDENTIAL_SHIELDING'
    | 'ARGUMENT_STRESS_LAB'
    | 'CASE_CLASSIFIER_ENGINE';

export type OptimizationPhase = 
    | 'IDLE'
    | 'ROLLOUT'
    | 'REFLECT'
    | 'EDIT'
    | 'VALIDATE'
    | 'COMPLETED'
    | 'REJECTED'
    | 'ERROR';

export interface TrainableSection {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly isLocked: boolean; // Immutable structural constraints (e.g. JSON schema contracts)
    content: string;
}

export interface SkillHyperparameters {
    admissibilityStrictness: 'STANDARD' | 'HIGH' | 'MAXIMUM';
    falsificationDepthRounds: number; // 1 to 4 turns
    citationFidelityThreshold: number; // 0 to 100%
    maxWordBudgetForEdits: number; // Prevent prompt bloat
    targetModel: string;
}

export interface SkillBenchmarkMetrics {
    readonly overallScore: number; // 0 - 100
    readonly evidentiaryRigor: number; // 0 - 100
    readonly factualFidelity: number; // 0 - 100
    readonly antiHallucination: number; // 0 - 100
    readonly proceduralAdmissibility: number; // 0 - 100
}

export interface SkillVersionRecord {
    readonly version: string;
    readonly timestamp: number;
    readonly author: 'HUMAN_EXPERT' | 'SKILLOPT_OPTIMIZER';
    readonly metrics: SkillBenchmarkMetrics;
    readonly heldOutScore: number;
    readonly commitMessage: string;
    readonly diffSummary?: string;
    readonly sectionsSnapshot: Record<string, string>;
    readonly parametersSnapshot: SkillHyperparameters;
}

export interface AgentSkillDocument {
    readonly id: SkillId;
    readonly name: string;
    readonly description: string;
    readonly jurisdiction: string; // e.g. "ALL" | "CO" | "ES" | "MX"
    version: string;
    lastOptimizedAt: number;
    currentMetrics: SkillBenchmarkMetrics;
    baselineMetrics: SkillBenchmarkMetrics;
    hyperparameters: SkillHyperparameters;
    sections: TrainableSection[];
    history: SkillVersionRecord[];
}

export interface SkillDiffChange {
    readonly sectionId: string;
    readonly sectionTitle: string;
    readonly previousText: string;
    readonly proposedText: string;
    readonly explanation: string;
}

export interface OptimizationCycleLog {
    readonly phase: OptimizationPhase;
    readonly timestamp: number;
    readonly message: string;
    readonly telemetryData?: Record<string, unknown>;
}

export interface OptimizationResult {
    readonly skillId: SkillId;
    readonly previousVersion: string;
    readonly newVersion: string;
    readonly status: 'ACCEPTED' | 'REJECTED' | 'ERROR';
    readonly previousScore: number;
    readonly candidateScore: number;
    readonly scoreDelta: number;
    readonly diffs: SkillDiffChange[];
    readonly reflectionNotes: string[];
    readonly logs: OptimizationCycleLog[];
    readonly executionTimeMs: number;
}

export interface LegalTestCase {
    readonly id: string;
    readonly title: string;
    readonly jurisdiction: string;
    readonly isHeldOutValidation: boolean; // true = validation set; false = training rollout
    readonly inputDocumentExcerpt: string;
    readonly evidenceItems: Array<{ fileName: string; content: string }>;
    readonly groundTruthCriteria: {
        mustDetectInconsistencies?: string[];
        mustFlagProceduralDefects?: string[];
        mustAvoidFalsePositives?: string[];
        expectedCoreVulnerability?: string;
    };
}
