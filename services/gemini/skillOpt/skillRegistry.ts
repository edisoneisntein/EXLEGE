import type {
    AgentSkillDocument,
    SkillId,
    SkillBenchmarkMetrics,
    SkillVersionRecord,
} from './types';
import { INITIAL_SKILL_DOCUMENTS } from './initialSkills';

const STORAGE_KEY = 'EX_LEGE_SKILLOPT_REGISTRY_V1';

type RegistryListener = (skills: AgentSkillDocument[]) => void;

class SkillRegistryService {
    private skills: Map<SkillId, AgentSkillDocument> = new Map();
    private listeners: Set<RegistryListener> = new Set();

    constructor() {
        this.initializeRegistry();
    }

    private initializeRegistry(): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const stored = window.localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored) as AgentSkillDocument[];
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        parsed.forEach(skill => {
                            this.skills.set(skill.id, skill);
                        });
                        // Ensure any missing initial skill is present
                        INITIAL_SKILL_DOCUMENTS.forEach(initialSkill => {
                            if (!this.skills.has(initialSkill.id)) {
                                this.skills.set(initialSkill.id, { ...initialSkill });
                            }
                        });
                        return;
                    }
                }
            }
        } catch {
            // Silently fallback to defaults
        }

        // Initialize with default skills
        INITIAL_SKILL_DOCUMENTS.forEach(skill => {
            this.skills.set(skill.id, { ...skill });
        });
    }

    private persist(): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const arrayData = Array.from(this.skills.values());
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arrayData));
            }
        } catch {
            // Fallback gracefully
        }
        this.notifyListeners();
    }

    private notifyListeners(): void {
        const currentList = this.getAllSkills();
        this.listeners.forEach(listener => {
            try {
                listener(currentList);
            } catch {
                // Ignore listener error
            }
        });
    }

    public subscribe(listener: RegistryListener): () => void {
        this.listeners.add(listener);
        listener(this.getAllSkills());
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getAllSkills(): AgentSkillDocument[] {
        return Array.from(this.skills.values());
    }

    public getSkill(id: SkillId): AgentSkillDocument | undefined {
        return this.skills.get(id);
    }

    public updateSkill(updated: AgentSkillDocument): void {
        this.skills.set(updated.id, updated);
        this.persist();
    }

    /**
     * Incrementa la versión semántica (patch/minor) tras una optimización exitosa
     */
    private bumpVersion(currentVersion: string): string {
        const parts = currentVersion.split('.').map(p => parseInt(p, 10) || 0);
        if (parts.length >= 2) {
            parts[parts.length - 1] = (parts[parts.length - 1] || 0) + 1;
            return parts.join('.');
        }
        return `${currentVersion}.1`;
    }

    /**
     * Promueve una versión optimizada tras validar que supera la compuerta de validación
     */
    public commitOptimizedVersion(
        skillId: SkillId,
        newSections: Record<string, string>,
        newMetrics: SkillBenchmarkMetrics,
        commitMessage: string,
        diffSummary?: string
    ): AgentSkillDocument {
        const skill = this.skills.get(skillId);
        if (!skill) {
            throw new Error(`Skill ${skillId} no existe en el registro.`);
        }

        const newVersion = this.bumpVersion(skill.version);
        const snapshot: Record<string, string> = {};

        // Aplicar los nuevos textos a las secciones correspondientes
        const updatedSections = skill.sections.map(section => {
            snapshot[section.id] = section.content;
            if (newSections[section.id] !== undefined && !section.isLocked) {
                return {
                    ...section,
                    content: newSections[section.id]!
                };
            }
            return section;
        });

        const newRecord: SkillVersionRecord = {
            version: newVersion,
            timestamp: Date.now(),
            author: 'SKILLOPT_OPTIMIZER',
            metrics: newMetrics,
            heldOutScore: newMetrics.overallScore,
            commitMessage,
            diffSummary,
            sectionsSnapshot: snapshot,
            parametersSnapshot: { ...skill.hyperparameters },
        };

        const updatedSkill: AgentSkillDocument = {
            ...skill,
            version: newVersion,
            lastOptimizedAt: Date.now(),
            currentMetrics: newMetrics,
            sections: updatedSections,
            history: [newRecord, ...skill.history],
        };

        this.skills.set(skillId, updatedSkill);
        this.persist();
        return updatedSkill;
    }

    /**
     * Revierte a una versión histórica previa del parámetro de texto
     */
    public rollbackToVersion(skillId: SkillId, targetVersion: string): boolean {
        const skill = this.skills.get(skillId);
        if (!skill) return false;

        const record = skill.history.find(h => h.version === targetVersion);
        if (!record) return false;

        const restoredSections = skill.sections.map(section => {
            if (record.sectionsSnapshot[section.id] !== undefined) {
                return {
                    ...section,
                    content: record.sectionsSnapshot[section.id]!
                };
            }
            return section;
        });

        const restoredSkill: AgentSkillDocument = {
            ...skill,
            version: targetVersion,
            currentMetrics: record.metrics,
            hyperparameters: { ...record.parametersSnapshot },
            sections: restoredSections,
        };

        this.skills.set(skillId, restoredSkill);
        this.persist();
        return true;
    }

    /**
     * Restablece el skill a los valores de fábrica de la versión base 1.0.0
     */
    public resetToBaseline(skillId: SkillId): void {
        const initial = INITIAL_SKILL_DOCUMENTS.find(s => s.id === skillId);
        if (initial) {
            this.skills.set(skillId, { ...initial });
            this.persist();
        }
    }

    /**
     * Ensambla el texto de prompt final combinando todas las secciones activas
     */
    public getCompiledPrompt(
        skillId: SkillId,
        placeholderReplacements?: Record<string, string>
    ): string {
        const skill = this.skills.get(skillId);
        if (!skill) {
            return '';
        }

        let compiled = skill.sections.map(s => s.content.trim()).join('\n\n');

        if (placeholderReplacements) {
            Object.entries(placeholderReplacements).forEach(([key, val]) => {
                compiled = compiled.split(key).join(val);
            });
        }

        return compiled;
    }

    /**
     * Exporta todos los skills y parámetros en formato JSON
     */
    public exportSkills(): string {
        return JSON.stringify(this.getAllSkills(), null, 2);
    }

    /**
     * Importa y valida parámetros de skills
     */
    public importSkills(jsonString: string): boolean {
        try {
            const parsed = JSON.parse(jsonString) as AgentSkillDocument[];
            if (!Array.isArray(parsed)) return false;

            parsed.forEach(skill => {
                if (skill.id && skill.sections && Array.isArray(skill.sections)) {
                    this.skills.set(skill.id, skill);
                }
            });
            this.persist();
            return true;
        } catch {
            return false;
        }
    }
}

export const skillRegistryService = new SkillRegistryService();
