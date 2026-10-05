import type { LegalTestCase } from './types';

/**
 * Banco de Calibración Forense de SkillOpt (Golden Dataset).
 * Incluye casos de entrenamiento (para Rollout y Reflect)
 * y casos de validación ciega (Held-Out Validation Set) para la compuerta estricta.
 */
export const SKILLOPT_BENCHMARK_CORPUS: readonly LegalTestCase[] = [
    // -------------------------------------------------------------------------
    // CASOS DE ENTRENAMIENTO (TRAINING ROLLOUT SET)
    // -------------------------------------------------------------------------
    {
        id: 'TRAIN-01-DISCORDANCIA-NOTARIAL',
        title: 'Discordancia Cronológica en Escritura Pública vs. Registro Inmobiliario',
        jurisdiction: 'CO',
        isHeldOutValidation: false,
        inputDocumentExcerpt: `
DEMANDA DE NULIDAD ABSOLUTA DE CONTRATO:
Hecho Tercero: El demandante y la demandada celebraron promesa y posterior escritura pública de compraventa No. 1420 el día 15 de marzo de 2021 en la Notaría 14 del Círculo de Dosquebradas, transfiriendo el inmueble con matrícula 290-88412 por la suma de $450.000.000 COP, habiendo pagado el comprador de contado en esa misma fecha.
        `.trim(),
        evidenceItems: [
            {
                fileName: 'ESCRITURA_1420_NOTARIA14.pdf',
                content: 'Escritura Pública 1420 otorgada el 28 de noviembre de 2021 ante la Notaría Catorce (14), en la que se estipula precio pagadero a 180 días con condición resolutoria expresa.'
            },
            {
                fileName: 'CERTIFICADO_TRADICION_290_88412.pdf',
                content: 'Anotación 04 del 02 de diciembre de 2021: Compraventa con condición resolutoria. No consta pago de contado.'
            }
        ],
        groundTruthCriteria: {
            mustDetectInconsistencies: [
                'Fecha de otorgamiento afirmada (15 de marzo 2021) versus fecha real de la escritura (28 de noviembre 2021)',
                'Forma de pago de contado afirmada versus condición resolutoria con plazo a 180 días estipulada en la prueba documental'
            ],
            expectedCoreVulnerability: 'Falsedad ideológica o alteración sustancial del título causa que destruye la exigibilidad de las pretensiones de entrega inmediata.'
        }
    },
    {
        id: 'TRAIN-02-CADUCIDAD-MEDIO-CONTROL',
        title: 'Cómputo Extemporáneo en Nulidad y Restablecimiento del Derecho',
        jurisdiction: 'CO',
        isHeldOutValidation: false,
        inputDocumentExcerpt: `
DEMANDA ANTE EL TRIBUNAL ADMINISTRATIVO:
Se solicita la nulidad de la Resolución No. 0892 del 10 de enero de 2022 notificada por aviso desfijado el 25 de enero de 2022. La demanda fue radicada el día 15 de octubre de 2022, manifestando la parte actora que se encontraba dentro de los 4 meses legales contados a partir del rechazo verbal de reconsideración del 30 de agosto de 2022.
        `.trim(),
        evidenceItems: [
            {
                fileName: 'NOTIFICACION_AVISO_RES0892.pdf',
                content: 'Acta de notificación por aviso del acto administrativo definitivo desfijado el 25 de enero de 2022. No se interpusieron recursos en sede administrativa en el término de 10 días.'
            },
            {
                fileName: 'CONSTANCIA_RADICACION_SAMAI.pdf',
                content: 'Registro de radicación electrónica en plataforma SAMAI con fecha 15 de octubre de 2022, hora 17:42.'
            }
        ],
        groundTruthCriteria: {
            mustDetectInconsistencies: [
                'Cómputo ilegal de caducidad pretendiendo extender el término de 4 meses con un supuesto rechazo verbal inexistente en la ley procesal',
                'Operancia consumada de la caducidad del medio de control (Art. 164 CPACA)'
            ],
            expectedCoreVulnerability: 'Caducidad sustancial y procesal del medio de control contencioso administrativo que amerita excepción previa de rechazo in limine.'
        }
    },

    // -------------------------------------------------------------------------
    // CASOS DE VALIDACIÓN CIEGA (HELD-OUT VALIDATION SET)
    // -------------------------------------------------------------------------
    {
        id: 'VAL-01-TESTIMONIO-SINGULAR-CONTRADICTORIO',
        title: 'Testimonio no Corroborado con Discordancia Horaria Crítica',
        jurisdiction: 'CO',
        isHeldOutValidation: true,
        inputDocumentExcerpt: `
ALEGATOS DE CONCLUSIÓN - PARTE ACTORA:
Quedó plenamente acreditado mediante el testimonio del señor Carlos Mario Gómez que la maquinaria pesada fue retirada intempestivamente el día 4 de julio a las 8:00 AM, generando la paralización total de la obra y el incumplimiento con los subcontratistas.
        `.trim(),
        evidenceItems: [
            {
                fileName: 'DECLARACION_JURAMENTADA_GOMEZ.pdf',
                content: 'Preguntado sobre la fecha del retiro de la maquinaria: Manifestó que no recordaba exactamente el día, que pudo haber sido a mediados de julio en horas de la tarde, y que él no estuvo presente en el momento del embarque.'
            },
            {
                fileName: 'BITACORA_DIGITAL_ACCESO_OBRA.pdf',
                content: 'Registro biométrico y de vehículos: El día 4 de julio la maquinaria operó normalmente hasta las 18:00 horas según reporte de operario Juan Pérez.'
            }
        ],
        groundTruthCriteria: {
            mustDetectInconsistencies: [
                'Contradicción entre la afirmación de retiro a las 8:00 AM y la bitácora que certifica operación hasta las 18:00 horas',
                'Falta de sustento directo: el declarante admite que no estuvo presente en el lugar de los hechos (testimonio de oídas / no presencial)'
            ],
            mustAvoidFalsePositives: [
                'No declarar nulo el contrato si solo se debate la indemnización de perjuicios'
            ],
            expectedCoreVulnerability: 'Inadmisibilidad del testimonio de oídas para fundamentar daño emergente frente a prueba documental técnica en contrario.'
        }
    },
    {
        id: 'VAL-02-INVERSION-CARGA-PROBATORIA',
        title: 'Inversión Ilícita de la Carga de la Prueba en Responsabilidad Médica',
        jurisdiction: 'CO',
        isHeldOutValidation: true,
        inputDocumentExcerpt: `
SENTENCIA DE PRIMERA INSTANCIA:
El Juzgado condena al médico tratante argumentando que no demostró su inocencia ni allegó prueba pericial concluyente que descartara una reacción alérgica imprevisible, trasladándole la carga de desvirtuar el resultado lesivo atribuido por el paciente.
        `.trim(),
        evidenceItems: [
            {
                fileName: 'HISTORIA_CLINICA_ANESTESIA.pdf',
                content: 'Consentimiento informado firmado con advertencia explícita del 1% de riesgo de anafilaxia refractaria. Parámetros de monitoreo dentro de guías internacionales.'
            },
            {
                fileName: 'DICTAMEN_MEDICINA_LEGAL.pdf',
                content: 'El perito oficial concluye que el procedimiento se ajustó a la lex artis ad hoc y que el desenlace correspondió a un shock idiopático no atribuible a mala praxis.'
            }
        ],
        groundTruthCriteria: {
            mustDetectInconsistencies: [
                'Imputación de responsabilidad desconociendo que la obligación médica general es de medios y no de resultado',
                'Contradicción frontal del fallo con el dictamen de Medicina Legal que acreditó cumplimiento de la lex artis'
            ],
            expectedCoreVulnerability: 'Vicio in iudicando por indebida aplicación de carga dinámica de la prueba e incongruencia frente a la prueba pericial pericial oficial.'
        }
    }
];
