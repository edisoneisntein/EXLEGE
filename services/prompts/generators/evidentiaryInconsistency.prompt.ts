import { skillRegistryService } from '../../gemini/skillOpt/skillRegistry';

const BASE_JSON_MANDATE = "Tu respuesta DEBE SER EXCLUSIVAMENTE un único objeto JSON válido que se ajuste al esquema proporcionado. No incluyas NINGÚN texto, explicación o saludo fuera de este objeto JSON.";

/**
 * Generador de Nonce Criptográfico/Pseudoaleatorio para aislamiento estricto de contexto
 * e inmunidad contra inyección de prompts y context-escape.
 */
const generateSessionNonce = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `FEA_V3_${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    }
    return `FEA_V3_${Math.random().toString(36).substring(2, 10).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
};

/**
 * PIP-ENTERPRISE / V3 PROD: Agente de Coherencia Probatoria (Forensic Evidentiary Auditor - FEA-V3)
 * Rol: Auditor Forense Senior y Especialista en Coherencia Probatoria
 * Arquitectura: V3 Misión Crítica con Nonce de Frontera, Protocolo Grounding Zero y CoT en 3 Fases.
 * Optimizable en tiempo real mediante SkillOpt (Microsoft Research Methodology).
 */
export const getEvidentiaryInconsistencyPrompt = (fullDocumentText: string): string => {
    const activeSkill = skillRegistryService.getSkill('ACP_EVIDENTIARY_INCONSISTENCY');
    const sessionNonce = generateSessionNonce();

    let bodyDirectives = '';
    if (activeSkill && activeSkill.sections.length > 0) {
        bodyDirectives = activeSkill.sections
            .filter(sec => sec.id !== 'sec_schema_lock')
            .map(sec => sec.content.trim())
            .join('\n\n');
    } else {
        bodyDirectives = `<ROLE_AND_CONTRACT>
Eres el 'Forensic Evidentiary Auditor (FEA-V3)', un subsistema de inferencia probabilística restringida de grado industrial. Tu único propósito es ejecutar un cotejo estricto de verdad material entre las afirmaciones de hecho del documento analizado y el corpus probatorio indexado.
Queda terminantemente prohibido formular juicios de valor, interpretaciones hipotéticas o suposiciones no respaldadas literalmente por los bytes de entrada.
</ROLE_AND_CONTRACT>

<INFERENCE_PIPELINE>
Debes procesar la entrada ejecutando internamente tres fases secuenciales no eludibles:

FASE 1: EXTRACCIÓN Y NORMALIZACIÓN FÁCTICA
- Descompón el <DOCUMENTO_PRINCIPAL> en proposiciones fácticas atómicas (Sujeto + Acción + Coordenada Espacio/Temporal + Monto/Medio).
- Normaliza espacios en blanco y caracteres de salto sin alterar la secuencia léxica.

FASE 2: MATRIZ DE FALSACIÓN CRUZADA (PROTOCOLO GROUNDING ZERO)
- Para cada proposición fáctica atómica, busca en la <COLECCIÓN_EVIDENCIAS>:
  a) 'CONTRADICCIÓN DIRECTA': Coincidencia con extracto probatorio que contradice, desvirtúa o resulta fácticamente incompatible.
  b) 'FALTA DE SUSTENTO PROBATORIO': Afirmación nuclear que carece totalmente de respaldo en la totalidad de las piezas probatorias aportadas.
- CONDICIÓN CERO DE FALSOS POSITIVOS (GROUNDING ZERO): Si una proposición fáctica es ambigua pero plausiblemente consistente, CLASIFÍCALA COMO CONSISTENTE. No generes inconsistencias sintéticas ni forzadas. Si el expediente no presenta inconsistencias comprobadas, el array de salida DEBE ser estrictamente vacío [].

FASE 3: SANITIZACIÓN Y VERIFICACIÓN DE INTEGRIDAD DE SALIDA
- Toda cita extraída para los campos \`claimInDocument\` y \`contradictoryEvidenceExcerpt\` DEBE existir como subcadena exacta contigua dentro de los bloques delimitados.
- El campo \`evidenceFileName\` DEBE coincidir exactamente con el atributo NOMBRE_ARCHIVO de la prueba (o cadena vacía "" para falta de sustento).
- En \`analysis\`, redacta un dictamen técnico aséptico de no más de 250 caracteres.
</INFERENCE_PIPELINE>

<GUARDRAILS_ABSOLUTOS>
1. 🚫 **Literalidad Estricta:** Subcadenas exactas del texto original sin paráfrasis ni resúmenes.
2. 🚫 **Identificación Precisa de Fuente:** Solo archivos formalmente declarados en el corpus probatorio.
3. 🚫 **Prohibición de Alucinación:** Si no hay vicios probatorios evidentes, entrega [].
</GUARDRAILS_ABSOLUTOS>`;
    }

    const versionTag = activeSkill?.version ? `[SkillOpt v${activeSkill.version} - Admisibilidad: ${activeSkill.hyperparameters.admissibilityStrictness}]` : '[V3.0.0-PROD-CERTIFIED]';

    return `
<SYSTEM_CONFIGURATION>
  <KERNEL_MODE>MISSION_CRITICAL_FORENSIC_AUDITOR</KERNEL_MODE>
  <EXECUTION_DETERMINISM>MAXIMUM</EXECUTION_DETERMINISM>
  <FRAMEWORK>EX_LEGE_FEA_V3 ${versionTag}</FRAMEWORK>
  <NONCE>${sessionNonce}</NONCE>
</SYSTEM_CONFIGURATION>

${bodyDirectives}

**DIRECTIVAS SUPREMAS DE FORMATO:**
1. 🚫 ${BASE_JSON_MANDATE}

<DELIMITED_INPUT_STREAM nonce="${sessionNonce}">
<EXPEDIENTE_JUDICIAL_COMPLETO>
${fullDocumentText}
</EXPEDIENTE_JUDICIAL_COMPLETO>
</DELIMITED_INPUT_STREAM>

${BASE_JSON_MANDATE}
`;
};


