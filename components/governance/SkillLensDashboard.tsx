import React, { memo, useState, useEffect, useMemo, useCallback } from 'react';
import {
    AgentSkillDocument,
    SkillId,
    OptimizationResult,
    OptimizationCycleLog,
    SkillVersionRecord,
    SkillHyperparameters,
} from '../../services/gemini/skillOpt/types';
import { skillRegistryService } from '../../services/gemini/skillOpt/skillRegistry';
import { skillOptEngine } from '../../services/gemini/skillOpt/skillOptEngine';
import {
    Cpu,
    Play,
    RotateCcw,
    CheckCircle2,
    XCircle,
    Sliders,
    Sparkles,
    GitCommit,
    FileText,
    ShieldAlert,
    BarChart3,
    Clock,
    Download,
    Upload,
    ChevronRight,
    AlertTriangle,
} from 'lucide-react';

export interface SkillLensDashboardProps {
    readonly initialSkillId?: SkillId;
    readonly onSkillChange?: (skillId: SkillId) => void;
}

export const SkillLensDashboard: React.FC<SkillLensDashboardProps> = memo(({
    initialSkillId = 'ACP_EVIDENTIARY_INCONSISTENCY',
    onSkillChange
}) => {
    const [skills, setSkills] = useState<AgentSkillDocument[]>(() => skillRegistryService.getAllSkills());
    const [selectedSkillId, setSelectedSkillId] = useState<SkillId>(initialSkillId);
    const [activeTab, setActiveTab] = useState<'PARAMETERS' | 'LENS_DIFF' | 'RUNNER' | 'HISTORY'>('PARAMETERS');

    // Optimization state
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationLogs, setOptimizationLogs] = useState<OptimizationCycleLog[]>([]);
    const [lastOptimizationResult, setLastOptimizationResult] = useState<OptimizationResult | null>(null);

    // Subscribe to registry updates
    useEffect(() => {
        const unsubscribe = skillRegistryService.subscribe(updatedList => {
            setSkills([...updatedList]);
        });
        return unsubscribe;
    }, []);

    const selectedSkill = useMemo(() => {
        return skills.find(s => s.id === selectedSkillId) || skills[0];
    }, [skills, selectedSkillId]);

    const handleSelectSkill = useCallback((id: SkillId) => {
        setSelectedSkillId(id);
        if (onSkillChange) {
            onSkillChange(id);
        }
    }, [onSkillChange]);

    const handleRunOptimization = useCallback(async () => {
        if (!selectedSkill || isOptimizing) return;

        setIsOptimizing(true);
        setOptimizationLogs([]);
        setLastOptimizationResult(null);
        setActiveTab('RUNNER');

        try {
            const result = await skillOptEngine.runOptimizationCycle(selectedSkill.id, logEntry => {
                setOptimizationLogs(prev => [...prev, logEntry]);
            });
            setLastOptimizationResult(result);
        } catch (err: any) {
            setOptimizationLogs(prev => [
                ...prev,
                {
                    phase: 'ERROR',
                    timestamp: Date.now(),
                    message: `Error durante el ciclo de optimización: ${err?.message || 'Fallo desconocido'}`
                }
            ]);
        } finally {
            setIsOptimizing(false);
        }
    }, [selectedSkill, isOptimizing]);

    const handleRollback = useCallback((targetVersion: string) => {
        if (!selectedSkill) return;
        const success = skillRegistryService.rollbackToVersion(selectedSkill.id, targetVersion);
        if (success) {
            setSkills([...skillRegistryService.getAllSkills()]);
        }
    }, [selectedSkill]);

    const handleResetBaseline = useCallback(() => {
        if (!selectedSkill) return;
        if (window.confirm(`¿Restablecer ${selectedSkill.name} a los valores de fábrica v1.0.0?`)) {
            skillRegistryService.resetToBaseline(selectedSkill.id);
            setSkills([...skillRegistryService.getAllSkills()]);
        }
    }, [selectedSkill]);

    const handleExport = useCallback(() => {
        const data = skillRegistryService.exportSkills();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ex_lege_skillopt_parameters_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = evt => {
            const content = evt.target?.result as string;
            if (content) {
                const ok = skillRegistryService.importSkills(content);
                if (ok) {
                    alert('Parámetros de SkillOpt importados exitosamente.');
                    setSkills([...skillRegistryService.getAllSkills()]);
                } else {
                    alert('El archivo importado no contiene un formato de SkillOpt válido.');
                }
            }
        };
        reader.readAsText(file);
    }, []);

    if (!selectedSkill) {
        return <div className="p-8 text-center text-slate-400">Cargando catálogo de habilidades...</div>;
    }

    const currentScore = selectedSkill.currentMetrics.overallScore;
    const baselineScore = selectedSkill.baselineMetrics.overallScore;
    const scoreDiff = +(currentScore - baselineScore).toFixed(1);

    return (
        <div id="skill-lens-dashboard" className="space-y-6 text-slate-100 font-sans">
            {/* Header Solemne */}
            <div className="bg-[#12071d] border border-[#C5A059]/40 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden court-gold-frame">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-cinzel font-bold bg-[#8a2232]/40 text-[#FFE898] border border-[#C5A059]/40 flex items-center gap-1.5">
                                <Cpu className="w-3 h-3 text-[#DFBA73]" />
                                MICROSOFT RESEARCH 2026 METHODOLOGY
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-cinzel font-bold bg-amber-500/15 text-amber-200 border border-amber-500/30">
                                TEXT-SPACE OPTIMIZATION
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-cinzel font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#DFBA73] via-[#FFE898] to-[#C5A059]">
                            SkillOpt & SkillLens: Habilidades como Parámetros Entrenables
                        </h2>
                        <p className="text-xs text-slate-300 font-garamond max-w-3xl leading-relaxed">
                            A diferencia de los prompts estáticos, SkillOpt trata las directivas metodológicas y cadenas de razonamiento como <strong>parámetros entrenables en el espacio de texto</strong>, auto-evolucionando mediante el bucle formal <em>Rollout → Reflect → Edit → Validate</em> con compuerta estricta en Held-Out Set.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="px-3 py-1.5 text-xs font-cinzel font-bold text-amber-200 bg-[#1e0e2e] hover:bg-[#2e1546] border border-[#C5A059]/30 rounded-xl transition-all flex items-center gap-1.5 shadow"
                            title="Exportar parámetros de SkillOpt"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportar</span>
                        </button>
                        <label className="px-3 py-1.5 text-xs font-cinzel font-bold text-amber-200 bg-[#1e0e2e] hover:bg-[#2e1546] border border-[#C5A059]/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Importar</span>
                            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                        </label>
                        <button
                            type="button"
                            onClick={handleResetBaseline}
                            className="px-3 py-1.5 text-xs font-cinzel font-bold text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 rounded-xl transition-all flex items-center gap-1.5 shadow"
                            title="Restablecer este skill a fábrica"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Fábrica</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Selector de Habilidad y Resumen Rápido de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Selector Lateral */}
                <div className="md:col-span-1 space-y-2">
                    <label className="text-[11px] font-cinzel font-bold uppercase tracking-wider text-[#DFBA73] block px-1">
                        Catálogo de Agentes Entrenables:
                    </label>
                    <div className="space-y-1.5">
                        {skills.map(skill => {
                            const isSelected = skill.id === selectedSkillId;
                            return (
                                <button
                                    key={skill.id}
                                    type="button"
                                    onClick={() => handleSelectSkill(skill.id)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${
                                        isSelected
                                            ? 'bg-[#2a133d] border-[#C5A059] text-white shadow-[0_0_15px_rgba(197,160,89,0.25)]'
                                            : 'bg-[#12071d]/70 border-[#C5A059]/20 text-slate-300 hover:bg-[#1a0c2a] hover:text-[#FFE898]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-cinzel font-bold truncate">
                                            {skill.name}
                                        </span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-[#C5A059]/30 text-amber-200">
                                            v{skill.version}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>Held-Out Score:</span>
                                        <span className="font-bold text-emerald-400">
                                            {skill.currentMetrics.overallScore}%
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Métricas y Estado del Agente Seleccionado */}
                <div className="md:col-span-3 bg-[#12071d]/90 border border-[#C5A059]/30 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C5A059]/20 pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-cinzel font-bold text-[#DFBA73] bg-[#C5A059]/15 px-2 py-0.5 rounded border border-[#C5A059]/30">
                                    ID: {selectedSkill.id}
                                </span>
                                <span className="text-xs font-mono text-slate-400">
                                    Versión Activa: <strong className="text-white">v{selectedSkill.version}</strong>
                                </span>
                            </div>
                            <h3 className="text-base font-cinzel font-bold text-[#FFE898] mt-1">
                                {selectedSkill.name}
                            </h3>
                            <p className="text-xs text-slate-300 font-garamond">
                                {selectedSkill.description}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleRunOptimization}
                            disabled={isOptimizing}
                            className={`px-4 py-2 rounded-xl font-cinzel font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
                                isOptimizing
                                    ? 'bg-amber-600/50 text-amber-100 cursor-not-allowed animate-pulse'
                                    : 'bg-gradient-to-r from-[#DFBA73] via-[#FFE898] to-[#C5A059] text-slate-950 hover:brightness-110 shadow-[0_0_20px_rgba(223,186,115,0.3)]'
                            }`}
                        >
                            <Play className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : 'fill-current'}`} />
                            <span>{isOptimizing ? 'Optimizando Parámetros...' : 'Ejecutar Ciclo SkillOpt (4 Fases)'}</span>
                        </button>
                    </div>

                    {/* Tarjetas de Métricas de Calibración */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-[#0a0412] p-3 rounded-xl border border-[#C5A059]/20">
                            <span className="text-[10px] font-cinzel uppercase text-slate-400 block">Puntaje Global</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-xl font-bold font-cinzel text-amber-200">{currentScore}%</span>
                                {scoreDiff !== 0 && (
                                    <span className={`text-[10px] font-bold ${scoreDiff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        ({scoreDiff > 0 ? '+' : ''}{scoreDiff}%)
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="bg-[#0a0412] p-3 rounded-xl border border-[#C5A059]/20">
                            <span className="text-[10px] font-cinzel uppercase text-slate-400 block">Rigor Probatorio</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-xl font-bold font-cinzel text-emerald-400">
                                    {selectedSkill.currentMetrics.evidentiaryRigor}%
                                </span>
                            </div>
                        </div>

                        <div className="bg-[#0a0412] p-3 rounded-xl border border-[#C5A059]/20">
                            <span className="text-[10px] font-cinzel uppercase text-slate-400 block">Anti-Alucinación</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-xl font-bold font-cinzel text-blue-400">
                                    {selectedSkill.currentMetrics.antiHallucination}%
                                </span>
                            </div>
                        </div>

                        <div className="bg-[#0a0412] p-3 rounded-xl border border-[#C5A059]/20">
                            <span className="text-[10px] font-cinzel uppercase text-slate-400 block">Admisibilidad Procesal</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-xl font-bold font-cinzel text-purple-300">
                                    {selectedSkill.currentMetrics.proceduralAdmissibility}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pestañas de Navegación del Dashboard */}
            <div className="flex items-center gap-2 border-b border-[#C5A059]/20 pb-2 overflow-x-auto text-xs font-cinzel font-bold">
                <button
                    type="button"
                    onClick={() => setActiveTab('PARAMETERS')}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'PARAMETERS'
                            ? 'bg-[#2a133d] text-[#FFE898] border border-[#C5A059] shadow-md'
                            : 'bg-[#12071d]/60 text-slate-400 hover:text-white border border-transparent'
                    }`}
                >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Secciones Entrenables ({selectedSkill.sections.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('RUNNER')}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'RUNNER'
                            ? 'bg-[#2a133d] text-[#FFE898] border border-[#C5A059] shadow-md'
                            : 'bg-[#12071d]/60 text-slate-400 hover:text-white border border-transparent'
                    }`}
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bucle de Optimización {isOptimizing && '(En Curso...)'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('LENS_DIFF')}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'LENS_DIFF'
                            ? 'bg-[#2a133d] text-[#FFE898] border border-[#C5A059] shadow-md'
                            : 'bg-[#12071d]/60 text-slate-400 hover:text-white border border-transparent'
                    }`}
                >
                    <FileText className="w-3.5 h-3.5" />
                    <span>SkillLens: Diff Forense</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('HISTORY')}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'HISTORY'
                            ? 'bg-[#2a133d] text-[#FFE898] border border-[#C5A059] shadow-md'
                            : 'bg-[#12071d]/60 text-slate-400 hover:text-white border border-transparent'
                    }`}
                >
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>Historial & Rollback ({selectedSkill.history.length})</span>
                </button>
            </div>

            {/* Contenido de la pestaña PARAMETERS */}
            {activeTab === 'PARAMETERS' && (
                <div className="space-y-4">
                    <div className="p-4 bg-[#140a22]/80 border border-[#C5A059]/25 rounded-2xl">
                        <span className="text-xs font-cinzel font-bold text-[#FFE898] flex items-center gap-2">
                            <span>⚙️</span>
                            <span>Hiperparámetros de Operación Epistémica</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 text-xs">
                            <div className="p-3 bg-black/40 rounded-xl border border-[#C5A059]/15">
                                <span className="text-slate-400 block">Exigencia de Admisibilidad:</span>
                                <span className="font-bold text-amber-300 uppercase mt-0.5 block">
                                    {selectedSkill.hyperparameters.admissibilityStrictness}
                                </span>
                            </div>
                            <div className="p-3 bg-black/40 rounded-xl border border-[#C5A059]/15">
                                <span className="text-slate-400 block">Turnos de Falsación (Steelman):</span>
                                <span className="font-bold text-amber-300 mt-0.5 block">
                                    {selectedSkill.hyperparameters.falsificationDepthRounds} rondas
                                </span>
                            </div>
                            <div className="p-3 bg-black/40 rounded-xl border border-[#C5A059]/15">
                                <span className="text-slate-400 block">Presupuesto de Palabras por Edición:</span>
                                <span className="font-bold text-amber-300 mt-0.5 block">
                                    {selectedSkill.hyperparameters.maxWordBudgetForEdits} palabras máx.
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {selectedSkill.sections.map(section => (
                            <div
                                key={section.id}
                                className="bg-[#12071d]/90 border border-[#C5A059]/30 rounded-2xl p-4 md:p-5 space-y-2"
                            >
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-cinzel font-bold text-[#DFBA73]">
                                            {section.title}
                                        </span>
                                        {section.isLocked ? (
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-500/30">
                                                INMUTABLE (CONTRATO JSON)
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                                ENTRENABLE EN TEXTO
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {section.content.split(/\s+/).length} palabras
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-garamond italic">
                                    {section.description}
                                </p>
                                <pre className="p-3 bg-[#08040d] border border-[#C5A059]/15 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                                    {section.content}
                                </pre>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Contenido de la pestaña RUNNER */}
            {activeTab === 'RUNNER' && (
                <div className="space-y-4">
                    {lastOptimizationResult && (
                        <div className={`p-4 rounded-2xl border ${
                            lastOptimizationResult.status === 'ACCEPTED'
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                        }`}>
                            <div className="flex items-center gap-3">
                                {lastOptimizationResult.status === 'ACCEPTED' ? (
                                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
                                )}
                                <div>
                                    <h4 className="font-cinzel font-bold text-sm">
                                        {lastOptimizationResult.status === 'ACCEPTED'
                                            ? `Optimización Aceptada y Promovida a v${lastOptimizationResult.newVersion}`
                                            : 'Optimización Rechazada por la Compuerta de Calidad'}
                                    </h4>
                                    <p className="text-xs font-garamond mt-0.5">
                                        Puntaje en Held-Out Set: {lastOptimizationResult.candidateScore}% (Delta: {lastOptimizationResult.scoreDelta > 0 ? '+' : ''}{lastOptimizationResult.scoreDelta}%).
                                        Tiempo de ejecución: {(lastOptimizationResult.executionTimeMs / 1000).toFixed(2)}s.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-[#08040d] border border-[#C5A059]/30 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2">
                            <span className="text-xs font-cinzel font-bold text-[#DFBA73] flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-[#FFE898]" />
                                Telemetría del Bucle SkillOpt (Rollout → Reflect → Edit → Validate)
                            </span>
                            {isOptimizing && (
                                <span className="text-[10px] font-cinzel font-bold text-amber-300 animate-pulse">
                                    PROCESANDO FASE ACTIVA...
                                </span>
                            )}
                        </div>

                        <div className="space-y-1.5 font-mono text-xs max-h-96 overflow-y-auto pr-2">
                            {optimizationLogs.length === 0 ? (
                                <div className="text-slate-500 py-8 text-center italic">
                                    Presione "Ejecutar Ciclo SkillOpt" para iniciar la optimización guiada por evaluación.
                                </div>
                            ) : (
                                optimizationLogs.map((entry, idx) => (
                                    <div key={idx} className="p-2 rounded bg-[#12071d]/60 border border-[#C5A059]/10 flex items-start gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            entry.phase === 'ROLLOUT' ? 'bg-blue-950 text-blue-300 border border-blue-500/30' :
                                            entry.phase === 'REFLECT' ? 'bg-purple-950 text-purple-300 border border-purple-500/30' :
                                            entry.phase === 'EDIT' ? 'bg-amber-950 text-amber-300 border border-amber-500/30' :
                                            entry.phase === 'VALIDATE' ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30' :
                                            entry.phase === 'COMPLETED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' :
                                            'bg-rose-950 text-rose-300 border border-rose-500/30'
                                        }`}>
                                            {entry.phase}
                                        </span>
                                        <span className="text-slate-300 leading-relaxed">
                                            {entry.message}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Contenido de la pestaña LENS_DIFF */}
            {activeTab === 'LENS_DIFF' && (
                <div className="space-y-4">
                    <div className="p-4 bg-[#12071d] border border-[#C5A059]/30 rounded-2xl">
                        <span className="text-xs font-cinzel font-bold text-[#FFE898] block">
                            SkillLens: Inspección Forense de Mutación de Parámetros
                        </span>
                        <p className="text-xs text-slate-300 font-garamond mt-1">
                            Auditoría de cambios quirúrgicos en las directivas de inferencia para asegurar no sobreafirmación ni drift del prompt.
                        </p>
                    </div>

                    {selectedSkill.history.length > 0 && (
                        <div className="space-y-3">
                            <div className="p-4 bg-[#0a0412] border border-emerald-500/30 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between text-xs font-cinzel">
                                    <span className="font-bold text-emerald-400">
                                        Última Modificación Aceptada (v{selectedSkill.version})
                                    </span>
                                    <span className="text-slate-400 font-mono text-[10px]">
                                        {new Date(selectedSkill.lastOptimizedAt).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-xs font-garamond text-slate-200">
                                    {selectedSkill.history[0]?.commitMessage || 'Sin mensaje de commit.'}
                                </p>
                                {selectedSkill.history[0]?.diffSummary && (
                                    <div className="p-2.5 bg-black/60 rounded-xl text-xs font-mono text-amber-200/90 border border-amber-500/20">
                                        {selectedSkill.history[0].diffSummary}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Contenido de la pestaña HISTORY */}
            {activeTab === 'HISTORY' && (
                <div className="space-y-3">
                    <div className="p-4 bg-[#12071d] border border-[#C5A059]/30 rounded-2xl">
                        <span className="text-xs font-cinzel font-bold text-[#FFE898] block">
                            Historial de Versiones & Reversión (Rollback)
                        </span>
                        <p className="text-xs text-slate-300 font-garamond mt-1">
                            Cada iteración aceptada por la compuerta de Held-Out queda archivada con su snapshot inmutable de parámetros y puntuación.
                        </p>
                    </div>

                    <div className="space-y-2">
                        {selectedSkill.history.map((record, index) => {
                            const isCurrent = record.version === selectedSkill.version;
                            return (
                                <div
                                    key={record.version}
                                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                        isCurrent
                                            ? 'bg-[#2a133d]/70 border-[#C5A059] shadow-md'
                                            : 'bg-[#12071d]/60 border-[#C5A059]/20'
                                    }`}
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/50 border border-[#C5A059]/30 text-[#FFE898]">
                                                v{record.version}
                                            </span>
                                            {isCurrent && (
                                                <span className="text-[10px] font-cinzel font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                                    ACTIVA
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-400 font-garamond">
                                                {new Date(record.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-xs font-garamond text-slate-200">
                                            {record.commitMessage}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-right text-xs">
                                            <span className="text-slate-400 block text-[10px] uppercase">Held-Out</span>
                                            <span className="font-bold text-emerald-400">{record.heldOutScore}%</span>
                                        </div>
                                        {!isCurrent && (
                                            <button
                                                type="button"
                                                onClick={() => handleRollback(record.version)}
                                                className="px-3 py-1.5 rounded-xl text-xs font-cinzel font-bold text-amber-200 bg-[#1e0e2e] hover:bg-[#2e1546] border border-[#C5A059]/30 shadow transition-all"
                                            >
                                                Revertir a esta
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

SkillLensDashboard.displayName = 'SkillLensDashboard';
export default SkillLensDashboard;
