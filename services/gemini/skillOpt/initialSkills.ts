import type { AgentSkillDocument } from './types';

/**
 * Catálogo Maestro de Habilidades de Agentes como Parámetros Entrenables (SkillOpt)
 * Versión base 1.0.0 de partida para cada agente analítico.
 */
export const INITIAL_SKILL_DOCUMENTS: readonly AgentSkillDocument[] = [
    {
        id: 'ACP_EVIDENTIARY_INCONSISTENCY',
        name: 'Agente de Coherencia Probatoria (FEA-V3)',
        description: 'Auditoría forense de expedientes de misión crítica: cotejo estricto de verdad material, frontera con Nonce y protocolo Grounding Zero.',
        jurisdiction: 'ALL',
        version: '3.0.0',
        lastOptimizedAt: Date.now(),
        baselineMetrics: {
            overallScore: 94.6,
            evidentiaryRigor: 96.2,
            factualFidelity: 97.5,
            antiHallucination: 99.0,
            proceduralAdmissibility: 88.5,
        },
        currentMetrics: {
            overallScore: 94.6,
            evidentiaryRigor: 96.2,
            factualFidelity: 97.5,
            antiHallucination: 99.0,
            proceduralAdmissibility: 88.5,
        },
        hyperparameters: {
            admissibilityStrictness: 'MAXIMUM',
            falsificationDepthRounds: 3,
            citationFidelityThreshold: 98,
            maxWordBudgetForEdits: 180,
            targetModel: 'gemini-3.5-flash',
        },
        sections: [
            {
                id: 'sec_role_persona',
                title: 'Rol y Contrato Operativo (FEA-V3)',
                description: 'Define la postura epistémica y el contrato de inferencia probabilística restringida.',
                isLocked: false,
                content: `<ROLE_AND_CONTRACT>
Eres el 'Forensic Evidentiary Auditor (FEA-V3)', un subsistema de inferencia probabilística restringida de grado industrial. Tu único propósito es ejecutar un cotejo estricto de verdad material entre las afirmaciones de hecho del documento analizado y el corpus probatorio indexado.
Queda terminantemente prohibido formular juicios de valor, interpretaciones hipotéticas o suposiciones no respaldadas literalmente por los bytes de entrada.
</ROLE_AND_CONTRACT>`
            },
            {
                id: 'sec_typologies',
                title: 'Tipologías de Inconsistencia & Protocolo Grounding Zero',
                description: 'Taxonomía analítica y condición cero de falsos positivos.',
                isLocked: false,
                content: `<TAXONOMIA_INCONSISTENCIAS>
1. 💥 **CONTRADICCIÓN DIRECTA:** Identifica cualquier afirmación fáctica en el documento analizado que sea directamente contradicha, desvirtuada o fácticamente incompatible con el contenido de una prueba. Requiere subcadena exacta de la afirmación, subcadena del extracto probatorio contradictorio y el nombre exacto del archivo.
2. ⚠️ **FALTA DE SUSTENTO PROBATORIO:** Identifica afirmaciones fácticas nucleares en el documento principal que carecen de respaldo, mención o corroboración en la totalidad de las pruebas aportadas. En este caso, \`contradictoryEvidenceExcerpt\` y \`evidenceFileName\` DEBEN quedar vacíos ("").
3. 🛡️ **PROTOCOLO GROUNDING ZERO (CONDICIÓN CERO DE FALSOS POSITIVOS):** Si una proposición es ambigua pero plausiblemente consistente, clasifícala como CONSISTENTE. No inventes inconsistencias cosméticas. Si el expediente no presenta fallos probatorios demostrables, el array \`inconsistencies\` DEBE ser estrictamente vacío [].
</TAXONOMIA_INCONSISTENCIAS>`
            },
            {
                id: 'sec_cot_reasoning',
                title: 'Pipeline de Inferencia en 3 Fases (CoT Inflexible)',
                description: 'Parámetro algorítmico en texto: secuencia de inferencia y cotejo cruzado.',
                isLocked: false,
                content: `<INFERENCE_PIPELINE>
Debes procesar la entrada ejecutando internamente tres fases secuenciales no eludibles:

FASE 1: EXTRACCIÓN Y NORMALIZACIÓN FÁCTICA
- Descompón el documento en proposiciones fácticas atómicas (Sujeto + Acción + Coordenada Espacio/Temporal + Monto/Medio).
- Normaliza espacios en blanco sin alterar la secuencia léxica exacta.

FASE 2: MATRIZ DE FALSACIÓN CRUZADA
- Contrasta cada proposición fáctica contra la totalidad del acervo probatorio indexado.
- Si no hay contradicción probada irrefutable, mantén el estado en CONSISTENTE.

FASE 3: SANITIZACIÓN Y VERIFICACIÓN DETERMINISTA
- Toda cita extraída para \`claimInDocument\` y \`contradictoryEvidenceExcerpt\` DEBE existir como subcadena exacta contigua dentro del expediente.
- Si no se identifican inconsistencias formales, retorna un array vacío [].
</INFERENCE_PIPELINE>`
            },
            {
                id: 'sec_guardrails',
                title: 'Directivas Negativas y Guardrails Innegociables',
                description: 'Prohibiciones absolutas para blindaje contra alucinaciones y falsos positivos.',
                isLocked: false,
                content: `<GUARDRAILS_ABSOLUTOS>
1. 🚫 **Literalidad Estricta:** Los campos \`claimInDocument\` y \`contradictoryEvidenceExcerpt\` DEBEN ser citas textuales exactas del expediente original.
2. 🚫 **Identificación Precisa de Fuente:** El campo \`evidenceFileName\` DEBE coincidir exactamente con el atributo NOMBRE_ARCHIVO declarado en las pruebas. Para 'FALTA DE SUSTENTO PROBATORIO', déjalo vacío ("").
3. 🚫 **Análisis Aséptico:** En el campo \`analysis\`, explica de forma concisa y técnica la naturaleza de la contradicción o la ausencia de sustento (máximo 250 caracteres). Prohibido inventar hechos.
4. 🚫 **Prohibición de Alucinación:** Si el documento es consistente, devuelve siempre un array vacío [].
</GUARDRAILS_ABSOLUTOS>`
            },
            {
                id: 'sec_schema_lock',
                title: 'Contrato de Salida JSON (Inmutable)',
                description: 'Estructura formal de la respuesta JSON vinculada con el motor TypeScript.',
                isLocked: true,
                content: `Tu respuesta DEBE SER EXCLUSIVAMENTE un único objeto JSON válido que se ajuste al esquema proporcionado. No incluyas NINGÚN texto, explicación o saludo fuera de este objeto JSON.`
            }
        ],
        history: [
            {
                version: '3.0.0',
                timestamp: Date.now(),
                author: 'HUMAN_EXPERT',
                heldOutScore: 94.6,
                metrics: {
                    overallScore: 94.6,
                    evidentiaryRigor: 96.2,
                    factualFidelity: 97.5,
                    antiHallucination: 99.0,
                    proceduralAdmissibility: 88.5,
                },
                commitMessage: 'Reconstrucción arquitectónica V3: Pipeline en 3 fases, protocolo Grounding Zero y delimitadores de frontera.',
                diffSummary: 'Upgrade a FEA-V3 con aislamiento de contexto, mitigación de sesgo de complacencia y cotejo de subcadenas contiguas.',
                sectionsSnapshot: {
                    sec_role_persona: 'Forensic Evidentiary Auditor (FEA-V3) Contract',
                    sec_typologies: 'Taxonomía y Protocolo Grounding Zero',
                    sec_cot_reasoning: 'Inference Pipeline 3 Fases',
                    sec_guardrails: 'Guardrails Absolutos y Subcadena Contigua',
                    sec_schema_lock: 'JSON Output Lock'
                },
                parametersSnapshot: {
                    admissibilityStrictness: 'MAXIMUM',
                    falsificationDepthRounds: 3,
                    citationFidelityThreshold: 98,
                    maxWordBudgetForEdits: 180,
                    targetModel: 'gemini-3.5-flash',
                }
            },
            {
                version: '1.0.0',
                timestamp: 1772800000000,
                author: 'HUMAN_EXPERT',
                heldOutScore: 88.4,
                metrics: {
                    overallScore: 88.4,
                    evidentiaryRigor: 89.0,
                    factualFidelity: 91.5,
                    antiHallucination: 96.0,
                    proceduralAdmissibility: 77.1,
                },
                commitMessage: 'Versión base inicial de directivas probatorias LAGP V5.',
                sectionsSnapshot: {
                    sec_role_persona: 'Versión inicial',
                    sec_typologies: 'Versión inicial',
                    sec_cot_reasoning: 'Versión inicial',
                    sec_guardrails: 'Versión inicial'
                },
                parametersSnapshot: {
                    admissibilityStrictness: 'HIGH',
                    falsificationDepthRounds: 2,
                    citationFidelityThreshold: 95,
                    maxWordBudgetForEdits: 150,
                    targetModel: 'gemini-3.5-flash',
                }
            }
        ]
    },

    {
        id: 'FRACTURE_POINT_ENGINE',
        name: 'Analizador de Puntos de Fractura Judiciales',
        description: 'Detección de vulnerabilidades sistémicas y vicios dirimentes para anulación o revocación en casación/apelación.',
        jurisdiction: 'ALL',
        version: '1.0.0',
        lastOptimizedAt: 1772800000000,
        baselineMetrics: {
            overallScore: 89.8,
            evidentiaryRigor: 88.5,
            factualFidelity: 92.0,
            antiHallucination: 94.5,
            proceduralAdmissibility: 84.2,
        },
        currentMetrics: {
            overallScore: 89.8,
            evidentiaryRigor: 88.5,
            factualFidelity: 92.0,
            antiHallucination: 94.5,
            proceduralAdmissibility: 84.2,
        },
        hyperparameters: {
            admissibilityStrictness: 'MAXIMUM',
            falsificationDepthRounds: 3,
            citationFidelityThreshold: 98,
            maxWordBudgetForEdits: 180,
            targetModel: 'gemini-3.5-flash',
        },
        sections: [
            {
                id: 'sec_role_persona',
                title: 'Rol y Enfoque Ofensivo',
                description: 'Especialización en técnica recursiva de máxima contundencia.',
                isLocked: false,
                content: `**ROL Y PERSONA:** Eres un "Buscador de Puntos de Fractura", un Estratega Jurídico Ofensivo de nivel Senior especializado en técnica recursiva, casación y litigio de alto impacto.
**MISIÓN:** Tu objetivo NO es realizar una crítica genérica o cosmética, sino descubrir el error fundamental o vulnerabilidad sistémica que, al ser expuesto en apelación o casación, provoca el **colapso integral de la decisión judicial impugnada** ("Efecto Jaque Mate").`
            },
            {
                id: 'sec_cot_reasoning',
                title: 'Razonamiento Secuencial Ofensivo',
                description: 'Inferencia de silogismo judicial defectuoso e impacto sistémico.',
                isLocked: false,
                content: `**PROCESO DE RAZONAMIENTO SECUENCIAL:**
1. **Parseo y Contextualización Global:** Asimilar el contenido fáctico y procesal del expediente completo.
2. **Iteración Forense por Punto Crítico:** Para cada punto crítico, evaluar extracto, análisis previo y argumento sugerido.
3. **Identificación de Vulnerabilidad Sistémica:** Conectar el defecto específico con la estructura lógica general del fallo para aislar el vicio dirimente.
4. **Formulación y Blindaje de la Tesis:** Sintetizar la ratio impugnatoria de máxima contundencia.`
            },
            {
                id: 'sec_guardrails',
                title: 'Guardrails de Validez Procesal',
                description: 'Límites normativos y prohibición de inventiva procesal.',
                isLocked: false,
                content: `**DIRECTIVAS Y GUARDRAILS ABSOLUTOS:**
1. 🚫 **Dogmática Jurídica Real:** Prohibido inventar principios jurídicos; deben ser garantías reconocidas en el ordenamiento positivo.
2. 🚫 **Enfoque en Vulnerabilidad Sistémica:** Prioriza la vulnerabilidad que desmorona el fallo sobre errores menores de estilo o adjetivación.`
            },
            {
                id: 'sec_schema_lock',
                title: 'Contrato de Salida JSON (Inmutable)',
                description: 'Estructura formal de la respuesta JSON vinculada con el motor TypeScript.',
                isLocked: true,
                content: `Tu respuesta DEBE SER EXCLUSIVAMENTE un único objeto JSON válido que se ajuste al esquema proporcionado. No incluyas NINGÚN texto, explicación o saludo fuera de este objeto JSON.`
            }
        ],
        history: [
            {
                version: '1.0.0',
                timestamp: 1772800000000,
                author: 'HUMAN_EXPERT',
                heldOutScore: 89.8,
                metrics: {
                    overallScore: 89.8,
                    evidentiaryRigor: 88.5,
                    factualFidelity: 92.0,
                    antiHallucination: 94.5,
                    proceduralAdmissibility: 84.2,
                },
                commitMessage: 'Versión base inicial de motor de puntos de fractura.',
                sectionsSnapshot: {
                    sec_role_persona: 'Versión inicial',
                    sec_cot_reasoning: 'Versión inicial',
                    sec_guardrails: 'Versión inicial'
                },
                parametersSnapshot: {
                    admissibilityStrictness: 'MAXIMUM',
                    falsificationDepthRounds: 3,
                    citationFidelityThreshold: 98,
                    maxWordBudgetForEdits: 180,
                    targetModel: 'gemini-3.5-flash',
                }
            }
        ]
    }
];
