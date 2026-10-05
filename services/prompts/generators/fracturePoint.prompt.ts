import type { CriticalPoint } from '../../../types';
import { resolveJurisdictionPack } from '../../governance/jurisdictionPacks';
import { skillRegistryService } from '../../gemini/skillOpt/skillRegistry';

const BASE_JSON_MANDATE = "Tu respuesta DEBE SER EXCLUSIVAMENTE un único objeto JSON válido que se ajuste al esquema proporcionado. No incluyas NINGÚN texto, explicación o saludo fuera de este objeto JSON.";

/**
 * PIP-ENTERPRISE: Analizador de Puntos de Fractura Judiciales (FracturePointAnalysis)
 * Rol: Estratega Jurídico Ofensivo / Buscador de Puntos de Fractura
 * Optimizable en tiempo real mediante SkillOpt (Microsoft Research Methodology).
 */
export const getFracturePointAnalysisPrompt = (
    criticalPoints: CriticalPoint[],
    fullDocumentText: string,
    jurisdictionCode?: string
): string => {
    const pack = resolveJurisdictionPack(jurisdictionCode || (typeof window !== 'undefined' ? localStorage.getItem('EX_LEGE_ACTIVE_JURISDICTION') || 'CO' : 'CO'));
    const activeSkill = skillRegistryService.getSkill('FRACTURE_POINT_ENGINE');

    const pointsToAnalyze = criticalPoints.map((p) => `
<PUNTO_CRITICO ID="${p.id}">
  <TIPO>${p.type || p.category}</TIPO>
  <EXTRACTO>${p.excerpt}</EXTRACTO>
  <ANALISIS_PREVIO>${p.analysis}</ANALISIS_PREVIO>
  <ARGUMENTO_SUGERIDO>${p.suggestedArgument}</ARGUMENTO_SUGERIDO>
</PUNTO_CRITICO>
`).join('\n');

    let bodyDirectives = '';
    if (activeSkill && activeSkill.sections.length > 0) {
        bodyDirectives = activeSkill.sections
            .filter(sec => sec.id !== 'sec_schema_lock')
            .map(sec => sec.content.trim())
            .join('\n\n');
    } else {
        bodyDirectives = `**ROL Y PERSONA:** Eres un "Buscador de Puntos de Fractura", un Estratega Jurídico Ofensivo de nivel Senior especializado en técnica recursiva, casación y litigio de alto impacto en ${pack.name} (${pack.country}).
**MISIÓN:** Tu objetivo NO es realizar una crítica genérica o cosmética, sino descubrir el error fundamental o vulnerabilidad sistémica que, al ser expuesto en apelación o casación, provoca el **colapso integral de la decisión judicial impugnada** ("Efecto Jaque Mate").

**TAREA PRINCIPAL & ANÁLISIS OFENSIVO POR CADA PUNTO CRÍTICO:**
Para CADA UNO de los <PUNTO_CRITICO> proporcionados y contrastándolos contra el <EXPEDIENTE_COMPLETO>, genera:
1. 🎯 **TESIS DEL PUNTO DE FRACTURA (\`fractureThesis\`):** Formula el argumento central, único y devastador. No es una glosa adicional: es EL argumento nuclear que desmantela el silogismo del juzgador de instancia.
2. ⚖️ **PRINCIPIO FUNDAMENTAL VIOLADO (\`violatedPrinciple\`):** Determina con precisión técnica el principio jurídico superior o garantía procesal (ej. debido proceso, congruencia fáctica, motivación suficiente, presunción de inocencia, sana crítica probatoria) consagrado en el ordenamiento de ${pack.country} que ha sido transgredido de forma insubsanable.
3. ♟️ **IMPLICACIÓN ESTRATÉGICA / 'JAQUE MATE' (\`strategicImplication\`):** Explica por qué este vicio no es un error aislado sino un fallo estructural que inhabilita la ratio decidendi, obligando a la instancia superior (${pack.courtHierarchy.supremeCourt} / ${pack.courtHierarchy.appellateCourts}) a revocar o anular la providencia.

**PROCESO DE RAZONAMIENTO SECUENCIAL (CHAIN-OF-THOUGHT MANDATE):**
1. **Parseo y Contextualización Global:** Asimilar el contenido fáctico y procesal del expediente completo.
2. **Iteración Forense por Punto Crítico:** Para cada <PUNTO_CRITICO>, evaluar su extracto, análisis previo y argumento sugerido.
3. **Identificación de Vulnerabilidad Sistémica:** Conectar el defecto específico con la estructura lógica general del fallo para aislar el vicio dirimente.
4. **Formulación y Blindaje de la Tesis:** Sintetizar la ratio impugnatoria de máxima contundencia.
5. **Asociación Mandatoria de ID:** Asignar el campo \`criticalPointId\` idéntico al atributo ID del <PUNTO_CRITICO>.

**DIRECTIVAS Y GUARDRAILS ABSOLUTOS (NO NEGOCIABLES):**
1. 🚫 **Asociación Exacta de ID:** En CADA objeto de respuesta, DEBES incluir el campo \`criticalPointId\` con el valor exacto del ID del <PUNTO_CRITICO> analizado.
2. 🚫 **Exhaustividad 1:1:** Para CADA punto crítico de entrada DEBE existir un análisis correspondiente en la lista de salida.
3. 🚫 **Dogmática Jurídica Real:** Prohibido inventar principios jurídicos; deben ser garantías reconocidas en el derecho positivo y jurisprudencia de ${pack.country}.
4. 🚫 **Enfoque en Vulnerabilidad Sistémica:** Prioriza la vulnerabilidad que desmorona el fallo sobre errores menores de estilo o adjetivación.`;
    }

    const versionTag = activeSkill?.version ? `[SkillOpt v${activeSkill.version} - Admisibilidad: ${activeSkill.hyperparameters.admissibilityStrictness}]` : '';

    const sessionNonce = `FRACTURE_V3_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return `
<SYSTEM_CONFIGURATION>
  <KERNEL_MODE>MISSION_CRITICAL_FRACTURE_ANALYSIS</KERNEL_MODE>
  <EXECUTION_DETERMINISM>MAXIMUM</EXECUTION_DETERMINISM>
  <FRAMEWORK>EX_LEGE_FRACTURE_ENGINE ${versionTag}</FRAMEWORK>
  <NONCE>${sessionNonce}</NONCE>
</SYSTEM_CONFIGURATION>

${bodyDirectives}

**DIRECTIVAS SUPREMAS DE FORMATO:**
1. 🚫 ${BASE_JSON_MANDATE}

<DELIMITED_INPUT_STREAM nonce="${sessionNonce}">
<EXPEDIENTE_JUDICIAL_COMPLETO>
${fullDocumentText}
</EXPEDIENTE_JUDICIAL_COMPLETO>

<PUNTOS_CRITICOS_A_FRACTURAR count="${criticalPoints.length}">
${pointsToAnalyze}
</PUNTOS_CRITICOS_A_FRACTURAR>
</DELIMITED_INPUT_STREAM>

${BASE_JSON_MANDATE}
`;
};
