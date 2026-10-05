/**
 * JURISDICTION PACKS — DYNAMIC ADAPTERS (LAGP V5 - SECCIÓN 25)
 * 
 * Permite que el sistema adapte dinámicamente la jerarquía normativa,
 * las Altas Cortes, las fuentes vinculantes y las reglas procesales según
 * el país detectado en el expediente, manteniendo intacta la gobernanza global.
 */

export interface JurisdictionPack {
    code: string;
    name: string;
    country: string;
    flag: string;
    courtHierarchy: {
        supremeCourt: string;
        constitutionalCourt: string;
        administrativeCourt?: string;
        appellateCourts: string;
        firstInstanceCourts: string;
    };
    sourceHierarchyRanks: string[];
    proceduralCodes: {
        administrative?: string;
        civil?: string;
        penal?: string;
        labor?: string;
        constitutional?: string;
    };
    precedentDoctrine: string;
    keyTerminology: {
        lawsuit: string;
        ruling: string;
        appeal: string;
        protectiveAction: string;
    };
    version?: string;
    source?: 'SYSTEM' | 'CUSTOM';
}

export type JurisdictionCode = 'CO' | 'MX' | 'ES' | 'AR' | 'US' | 'PE' | 'CL' | 'EC' | 'GENERIC' | string;

export type JurisdictionSignalType = 'COUNTRY' | 'COURT' | 'CODE' | 'PROCEDURAL' | 'GENERIC';

export interface DetectionSignal {
    term: string;
    weight: number;
    type: JurisdictionSignalType;
    exact?: boolean;
}

export interface JurisdictionEvidence {
    signal: string;
    type: JurisdictionSignalType;
    weight: number;
    matched: string;
}

export interface JurisdictionAlternative {
    code: string;
    score: number;
}

export interface JurisdictionResolution {
    code: string;
    pack: JurisdictionPack;
    score: number;
    confidence: number;
    heuristicConfidence: number;
    evidence: JurisdictionEvidence[];
    alternatives: JurisdictionAlternative[];
    ambiguous: boolean;
    method: 'DIRECT_CODE' | 'RULES' | 'CUSTOM' | 'FALLBACK';
    engineVersion: string;
    catalogVersion: string;
}

export const JURISDICTION_PACKS: Record<string, JurisdictionPack> = {
    CO: {
        code: 'CO',
        name: 'Colombia',
        country: 'Colombia',
        flag: '🇨🇴',
        courtHierarchy: {
            supremeCourt: 'Corte Suprema de Justicia (Salas de Casación Civil, Laboral, Penal)',
            constitutionalCourt: 'Corte Constitucional (Sentencias C, SU, T)',
            administrativeCourt: 'Consejo de Estado (Salas de lo Contencioso Administrativo y Sala Plena)',
            appellateCourts: 'Tribunales Superiores de Distrito Judicial y Tribunales Administrativos',
            firstInstanceCourts: 'Juzgados de Circuito y Municipales / Administrativos'
        },
        sourceHierarchyRanks: [
            '1. Constitución Política & Bloque de Constitucionalidad',
            '2. Leyes Estatutarias y Orgánicas',
            '3. Leyes Ordinarias y Decretos con Fuerza de Ley',
            '4. Decretos Reglamentarios Nacionales',
            '5. Actos Administrativos de Autoridades Seccionales/Locales',
            '6. Jurisprudencia Constitucional de Control Abstracto (Sentencias C)',
            '7. Sentencias de Unificación Jurisprudencial (Corte Constitucional SU, Consejo de Estado)',
            '8. Doctrina Constitucional Vinculante y Precedente Relevante',
            '9. Jurisprudencia Reiterada y Líneas Consolidadas',
            '10. Pronunciamientos Judiciales Aislados',
            '11. Conceptos y Doctrina Administrativa Oficial',
            '12. Doctrina Académica y Criterio Auxiliar',
            '13. Principios Generales del Derecho y Costumbre'
        ],
        proceduralCodes: {
            administrative: 'CPACA (Ley 1437 de 2011, modificada por Ley 2080 de 2021)',
            civil: 'Código General del Proceso (Ley 1564 de 2012)',
            penal: 'Código de Procedimiento Penal (Ley 906 de 2004)',
            labor: 'Código Procesal del Trabajo y de la Seguridad Social',
            constitutional: 'Decreto 2591 de 1991 (Acción de Tutela) y CP art. 86'
        },
        precedentDoctrine: 'Doctrina de precedente vinculante de la Corte Constitucional (Sentencias C y SU) y Sentencias de Unificación del Consejo de Estado como fuente obligatoria para autoridades y jueces.',
        keyTerminology: {
            lawsuit: 'Demanda / Medio de Control',
            ruling: 'Sentencia / Auto Interlocutorio',
            appeal: 'Recurso de Apelación / Reposición',
            protectiveAction: 'Acción de Tutela'
        }
    },
    MX: {
        code: 'MX',
        name: 'México',
        country: 'México',
        flag: '🇲🇽',
        courtHierarchy: {
            supremeCourt: 'Suprema Corte de Justicia de la Nación (SCJN - Pleno y Salas)',
            constitutionalCourt: 'SCJN (Control Concentrado de Constitucionalidad y Convencionalidad)',
            administrativeCourt: 'Tribunal Federal de Justicia Administrativa (TFJA)',
            appellateCourts: 'Plenos Regionales y Tribunales Colegiados de Circuito',
            firstInstanceCourts: 'Juzgados de Distrito y Tribunales Colegiados de Apelación'
        },
        sourceHierarchyRanks: [
            '1. Constitución Política de los Estados Unidos Mexicanos & Tratados de DDHH',
            '2. Tratados Internacionales Ordinarios',
            '3. Leyes Generales, Federales y Reglamentarias',
            '4. Reglamentos Federales y Decretos Presidenciales',
            '5. Leyes y Reglamentos Estatales',
            '6. Jurisprudencia por Precedentes Obligatorios (SCJN Pleno y Salas)',
            '7. Jurisprudencia por Reiteración de Criterios (Tribunales Colegiados)',
            '8. Jurisprudencia por Contradicción de Criterios (Plenos Regionales / SCJN)',
            '9. Tesis Aisladas Publicadas en el Semanario Judicial',
            '10. Doctrina y Criterios Administrativos del SAT / Prodecon',
            '11. Doctrina Jurídica Académica',
            '12. Principios Generales de Derecho'
        ],
        proceduralCodes: {
            administrative: 'Ley Federal de Procedimiento Contencioso Administrativo (LFPCA)',
            civil: 'Código Nacional de Procedimientos Civiles y Familiares (CNPCF)',
            penal: 'Código Nacional de Procedimientos Penales (CNPP)',
            constitutional: 'Ley de Amparo (Reglamentaria de los Arts. 103 y 107 Constitucionales)'
        },
        precedentDoctrine: 'Sistema de Precedentes Obligatorios por votación calificada de la SCJN (Reforma Constitucional 2021) y Jurisprudencia vinculante del Semanario Judicial de la Federación.',
        keyTerminology: {
            lawsuit: 'Demanda de Juicio de Nulidad / Amparo',
            ruling: 'Sentencia Definitiva / Laudo',
            appeal: 'Recurso de Revisión / Queja / Reclamación',
            protectiveAction: 'Juicio de Amparo (Indirecto / Directo)'
        }
    },
    ES: {
        code: 'ES',
        name: 'España',
        country: 'España',
        flag: '🇪🇸',
        courtHierarchy: {
            supremeCourt: 'Tribunal Supremo (Salas de lo Civil, Penal, Contencioso-Administrativo, Social, Militar)',
            constitutionalCourt: 'Tribunal Constitucional (Intérprete supremo de la CE)',
            appellateCourts: 'Audiencia Nacional y Tribunales Superiores de Justicia de las CCAA',
            firstInstanceCourts: 'Audiencias Provinciales y Juzgados de Primera Instancia / Instrucción / Contencioso'
        },
        sourceHierarchyRanks: [
            '1. Constitución Española de 1978 & Derecho de la Unión Europea (Primacía TJUE)',
            '2. Tratados Internacionales Ratificados',
            '3. Leyes Orgánicas',
            '4. Leyes Ordinarias y Reales Decretos-Leyes / Legislativos',
            '5. Reglamentos Estatales (Reales Decretos, Órdenes Ministeriales)',
            '6. Leyes y Reglamentos de Comunidades Autónomas',
            '7. Jurisprudencia del Tribunal Constitucional (STC)',
            '8. Jurisprudencia del Tribunal Supremo (Doctrina reiterada - 2 o más sentencias)',
            '9. Doctrina de Tribunales Superiores de Justicia',
            '10. Costumbre y Principios Generales del Derecho',
            '11. Doctrina de la Dirección General de Seguridad Jurídica y Fe Pública',
            '12. Doctrina Científica'
        ],
        proceduralCodes: {
            administrative: 'Ley 39/2015 del Procedimiento Administrativo Común & Ley 29/1998 (LJCA)',
            civil: 'Ley 1/2000, de Enjuiciamiento Civil (LEC)',
            penal: 'Ley de Enjuiciamiento Criminal (LECrim)',
            labor: 'Ley 36/2011, Reguladora de la Jurisdicción Social (LRJS)',
            constitutional: 'Ley Orgánica 2/1979 del Tribunal Constitucional (LOTC)'
        },
        precedentDoctrine: 'Doctrina legal consolidada del Tribunal Supremo con valor complementario al ordenamiento jurídico (art. 1.6 Código Civil) y vinculación erga omnes de las resoluciones del TC.',
        keyTerminology: {
            lawsuit: 'Demanda Contencioso-Administrativa / Demanda Ordinaria',
            ruling: 'Sentencia / Auto',
            appeal: 'Recurso de Casación / Recurso de Apelación',
            protectiveAction: 'Recurso de Amparo Constitucional'
        }
    },
    AR: {
        code: 'AR',
        name: 'Argentina',
        country: 'Argentina',
        flag: '🇦🇷',
        courtHierarchy: {
            supremeCourt: 'Corte Suprema de Justicia de la Nación (CSJN)',
            constitutionalCourt: 'CSJN (Control difuso de constitucionalidad)',
            appellateCourts: 'Cámaras Nacionales y Federales de Apelaciones',
            firstInstanceCourts: 'Juzgados Nacionales y Federales de Primera Instancia'
        },
        sourceHierarchyRanks: [
            '1. Constitución Nacional & Tratados Internacionales con Jerarquía Constitucional (art. 75 inc. 22)',
            '2. Tratados Internacionales Integracionistas y de Rango Superior a las Leyes',
            '3. Leyes del Congreso de la Nación (Leyes Federales y Comunes)',
            '4. Decretos de Necesidad y Urgencia (DNU) y Decretos Reglamentarios del PEN',
            '5. Resoluciones Ministeriales y Actos Administrativos',
            '6. Constituciones y Leyes Provinciales / CABA',
            '7. Precedentes de la CSJN (Fuerza moral y deber institucional de acatamiento)',
            '8. Fallos Plenarios de Cámaras de Apelaciones',
            '9. Jurisprudencia de Tribunales Inferiores',
            '10. Doctrina de la Procuración del Tesoro de la Nación',
            '11. Doctrina de Autores y Principios Generales del Derecho'
        ],
        proceduralCodes: {
            administrative: 'Ley 19.549 de Procedimientos Administrativos (LNPA)',
            civil: 'Código Procesal Civil y Comercial de la Nación (CPCCN)',
            penal: 'Código Procesal Penal Federal (CPPF)',
            constitutional: 'Ley 16.986 de Acción de Amparo'
        },
        precedentDoctrine: 'Fuerza vinculante institucional de la jurisprudencia de la CSJN como custodio supremo de la Constitución y fuerza obligatoria de fallos plenarios de Cámara.',
        keyTerminology: {
            lawsuit: 'Demanda Ordinaria / Impugnación de Acto Administrativo',
            ruling: 'Sentencia Definitiva / Sentencia Interlocutoria',
            appeal: 'Recurso Extraordinario Federal (REF) / Recurso de Apelación',
            protectiveAction: 'Acción de Amparo / Medida Cautelar Autónoma'
        }
    },
    US: {
        code: 'US',
        name: 'Estados Unidos (Federal & State)',
        country: 'USA',
        flag: '🇺🇸',
        courtHierarchy: {
            supremeCourt: 'Supreme Court of the United States (SCOTUS)',
            constitutionalCourt: 'SCOTUS / Federal District Courts (Judicial Review - Marbury v. Madison)',
            appellateCourts: 'United States Courts of Appeals (13 Circuit Courts)',
            firstInstanceCourts: 'United States District Courts (94 Federal Districts)'
        },
        sourceHierarchyRanks: [
            '1. United States Constitution & Supremacy Clause (Art. VI)',
            '2. Federal Statutes (United States Code - U.S.C.) & Treaties',
            '3. Federal Regulations (Code of Federal Regulations - C.F.R.) & Executive Orders',
            '4. State Constitutions & State Statutes',
            '5. SCOTUS Precedent (Binding Stare Decisis)',
            '6. Circuit Court Precedent (Binding within circuit / Persuasive elsewhere)',
            '7. District Court Decisions (Persuasive authority)',
            '8. State Supreme Court Decisions on State Law Questions',
            '9. Administrative Agency Adjudications & Opinion Letters',
            '10. Restatements of the Law & Legal Treatises'
        ],
        proceduralCodes: {
            civil: 'Federal Rules of Civil Procedure (FRCP)',
            penal: 'Federal Rules of Criminal Procedure (FRCrP)',
            administrative: 'Administrative Procedure Act (APA - 5 U.S.C.)'
        },
        precedentDoctrine: 'Doctrine of Stare Decisis (Vertical binding precedent from higher courts and horizontal precedent adherence). Strict adherence to ratio decidendi and distinction of dicta.',
        keyTerminology: {
            lawsuit: 'Complaint / Motion to Dismiss',
            ruling: 'Judgment / Order / Opinion',
            appeal: 'Notice of Appeal / Petition for Writ of Certiorari',
            protectiveAction: 'Injunction / Temporary Restraining Order (TRO) / Habeas Corpus'
        }
    },
    PE: {
        code: 'PE',
        name: 'Perú',
        country: 'Perú',
        flag: '🇵🇪',
        courtHierarchy: {
            supremeCourt: 'Corte Suprema de Justicia de la República (Salas Civiles, Penales, de Derecho Constitucional y Social)',
            constitutionalCourt: 'Tribunal Constitucional del Perú (Órgano supremo de interpretación y control de constitucionalidad)',
            appellateCourts: 'Cortes Superiores de Justicia (Salas Superiores)',
            firstInstanceCourts: 'Juzgados Especializados y Mixtos / Juzgados de Paz Letrados'
        },
        sourceHierarchyRanks: [
            '1. Constitución Política del Perú de 1993 & Tratados de DDHH',
            '2. Tratados Internacionales Ratificados',
            '3. Leyes Orgánicas y Leyes Ordinarias',
            '4. Decretos Legislativos y Decretos de Urgencia',
            '5. Decretos Supremos y Reglamentos del Poder Ejecutivo',
            '6. Ordenanzas Regionales y Municipales',
            '7. Precedentes Vinculantes del Tribunal Constitucional (STC)',
            '8. Precedentes Judiciales de Plenos Casatorios de la Corte Suprema',
            '9. Jurisprudencia Reiterada y Resoluciones Administrativas',
            '10. Doctrina Jurídica y Costumbre'
        ],
        proceduralCodes: {
            administrative: 'TUO de la Ley 27444 (Ley del Procedimiento Administrativo General)',
            civil: 'Código Procesal Civil (Decreto Legislativo 768)',
            penal: 'Código Procesal Penal (Decreto Legislativo 957)',
            constitutional: 'Nuevo Código Procesal Constitucional (Ley 31307)'
        },
        precedentDoctrine: 'Precedentes vinculantes expedidos por el Tribunal Constitucional y sentencias dictadas en Plenos Casatorios de la Corte Suprema conforme al artículo 400 del CPC.',
        keyTerminology: {
            lawsuit: 'Demanda Contencioso-Administrativa / Demanda Civil',
            ruling: 'Sentencia / Auto / Casación',
            appeal: 'Recurso de Apelación / Recurso de Casación',
            protectiveAction: 'Proceso de Amparo / Hábeas Corpus'
        }
    },
    CL: {
        code: 'CL',
        name: 'Chile',
        country: 'Chile',
        flag: '🇨🇱',
        courtHierarchy: {
            supremeCourt: 'Corte Suprema de Justicia de Chile',
            constitutionalCourt: 'Tribunal Constitucional de Chile (Control preventivo y de inaplicabilidad)',
            appellateCourts: 'Cortes de Apelaciones',
            firstInstanceCourts: 'Juzgados de Letras, Juzgados de Garantía, Tribunales de Juicio Oral en lo Penal'
        },
        sourceHierarchyRanks: [
            '1. Constitución Política de la República de Chile & Tratados de DDHH (art. 5° inc. 2°)',
            '2. Tratados Internacionales Promulgados',
            '3. Leyes Orgánicas Constitucionales y de Quórum Calificado',
            '4. Leyes Ordinarias y Decretos con Fuerza de Ley (DFL)',
            '5. Decretos Supremos y Reglamentos Presidenciales',
            '6. Autos Acordados de la Corte Suprema y Cortes de Apelaciones',
            '7. Sentencias del Tribunal Constitucional (Inaplicabilidad e Inconstitucionalidad)',
            '8. Jurisprudencia Uniforme de la Corte Suprema',
            '9. Dictámenes de la Contraloría General de la República (CGR)',
            '10. Doctrina de los Autores'
        ],
        proceduralCodes: {
            administrative: 'Ley 19.880 (Bases de los Procedimientos Administrativos)',
            civil: 'Código de Procedimiento Civil (CPC)',
            penal: 'Código Procesal Penal (CPP)',
            labor: 'Código del Trabajo (Procedimiento de Tutela Laboral)'
        },
        precedentDoctrine: 'Efecto relativo de las sentencias judiciales (art. 3° Código Civil), con fuerza persuasiva y unificadora mediante el Recurso de Casación en el Fondo de la Corte Suprema.',
        keyTerminology: {
            lawsuit: 'Demanda Ordinaria / Reclamo de Ilegalidad',
            ruling: 'Sentencia Definitiva / Sentencia Interlocutoria',
            appeal: 'Recurso de Apelación / Casación en la Forma y en el Fondo',
            protectiveAction: 'Recurso de Protección / Recurso de Amparo'
        }
    },
    EC: {
        code: 'EC',
        name: 'Ecuador',
        country: 'Ecuador',
        flag: '🇪🇨',
        courtHierarchy: {
            supremeCourt: 'Corte Nacional de Justicia',
            constitutionalCourt: 'Corte Constitucional del Ecuador',
            appellateCourts: 'Cortes Provinciales de Justicia',
            firstInstanceCourts: 'Tribunales y Unidades Judiciales'
        },
        sourceHierarchyRanks: [
            '1. Constitución de la República del Ecuador & Instrumentos Internacionales de DDHH',
            '2. Tratados y Convenios Internacionales',
            '3. Leyes Orgánicas',
            '4. Leyes Ordinarias',
            '5. Normas Regionales y Ordenanzas Distritales / Municipales',
            '6. Decretos y Reglamentos del Ejecutivo',
            '7. Sentencias y Precedentes Vinculantes de la Corte Constitucional',
            '8. Resoluciones con Fuerza de Ley de la Corte Nacional de Justicia (Triple Reiteración)',
            '9. Doctrina Jurídica'
        ],
        proceduralCodes: {
            administrative: 'Código Orgánico Administrativo (COA)',
            civil: 'Código Orgánico General de Procesos (COGEP)',
            penal: 'Código Orgánico Integral Penal (COIP)',
            constitutional: 'Ley Orgánica de Garantías Jurisdiccionales y Control Constitucional (LOGJCC)'
        },
        precedentDoctrine: 'Jurisprudencia vinculante de la Corte Constitucional y resoluciones de jurisprudencia obligatoria de la Corte Nacional de Justicia.',
        keyTerminology: {
            lawsuit: 'Demanda Contencioso-Administrativa / Demanda Ordinaria',
            ruling: 'Sentencia / Auto Resolutorio',
            appeal: 'Recurso de Apelación / Recurso de Casación',
            protectiveAction: 'Acción de Protección / Acción Extraordinaria de Protección'
        }
    },
    GENERIC: {
        code: 'GENERIC',
        name: 'Jurisdicción Universal / Internacional',
        country: 'Internacional / General',
        flag: '🌐',
        courtHierarchy: {
            supremeCourt: 'Corte Suprema o Tribunal de Casación de la Jurisdicción',
            constitutionalCourt: 'Tribunal Constitucional / Corte de Garantías',
            administrativeCourt: 'Tribunal Contencioso-Administrativo o Sala Especializada',
            appellateCourts: 'Cortes o Cámaras de Apelaciones',
            firstInstanceCourts: 'Juzgados de Primera Instancia'
        },
        sourceHierarchyRanks: [
            '1. Norma Constitucional & Tratados Internacionales de Derechos Humanos',
            '2. Tratados Internacionales Ratificados',
            '3. Leyes del Parlamento / Congreso',
            '4. Reglamentos del Poder Ejecutivo',
            '5. Actos Administrativos Generales y Especiales',
            '6. Jurisprudencia del Tribunal Constitucional o Máxima Corte',
            '7. Precedentes Judiciales Vinculantes de Tribunales Superiores',
            '8. Jurisprudencia Reiterada y Consistente',
            '9. Jurisprudencia Aislada',
            '10. Doctrina de Autoridades Administrativas Reguladoras',
            '11. Doctrina de Tratadistas Reconocidos',
            '12. Principios Generales del Derecho y Equidad'
        ],
        proceduralCodes: {
            administrative: 'Código de Procedimiento Administrativo de la Jurisdicción',
            civil: 'Código de Procedimiento Civil',
            penal: 'Código de Procedimiento Penal',
            constitutional: 'Garantías Constitucionales y Mecanismos de Protección'
        },
        precedentDoctrine: 'El precedente de las Altas Cortes orienta la interpretación obligatoria o persuasiva del ordenamiento jurídico según la tradición de derecho civil o común.',
        keyTerminology: {
            lawsuit: 'Demanda / Acción Judicial',
            ruling: 'Sentencia / Resolución Judicial',
            appeal: 'Recurso de Apelación / Alzada / Impugnación',
            protectiveAction: 'Acción Constitucional de Protección / Amparo'
        }
    }
};

/* -------------------------------------------------------------------------- */
/* NORMALIZATION                                                              */
/* -------------------------------------------------------------------------- */

function normalizeJurisdictionText(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeJurisdictionCode(value: unknown): string {
    return normalizeJurisdictionText(value).replace(/[^A-Z0-9_-]/g, '');
}

function containsExactToken(text: string, token: string): boolean {
    const normalizedToken = normalizeJurisdictionText(token);
    if (!normalizedToken) return false;

    if (normalizedToken.length <= 3) {
        const escaped = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|[^A-Z0-9])${escaped}(?:[^A-Z0-9]|$)`, 'u').test(text);
    }

    return text.includes(normalizedToken);
}

/* -------------------------------------------------------------------------- */
/* DETECTION SIGNALS (PONDERACIÓN DOGMÁTICA)                                  */
/* -------------------------------------------------------------------------- */

const JURISDICTION_SIGNALS: Record<string, DetectionSignal[]> = {
    CO: [
        { term: 'COLOMBIA', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'REPUBLICA DE COLOMBIA', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'CONSEJO DE ESTADO', weight: 85, type: 'COURT' },
        { term: 'CORTE CONSTITUCIONAL', weight: 85, type: 'COURT' },
        { term: 'CORTE SUPREMA DE JUSTICIA', weight: 80, type: 'COURT' },
        { term: 'TRIBUNAL SUPERIOR DE DISTRITO JUDICIAL', weight: 75, type: 'COURT' },
        { term: 'TRIBUNAL ADMINISTRATIVO', weight: 70, type: 'COURT' },
        { term: 'CPACA', weight: 80, type: 'CODE' },
        { term: 'CODIGO GENERAL DEL PROCESO', weight: 80, type: 'CODE' },
        { term: 'LEY 1437', weight: 75, type: 'CODE' },
        { term: 'LEY 1564', weight: 75, type: 'CODE' },
        { term: 'LEY 906 DE 2004', weight: 80, type: 'CODE' },
        { term: 'DECRETO 2591', weight: 75, type: 'CODE' },
        { term: 'ACCION DE TUTELA', weight: 30, type: 'PROCEDURAL' },
        { term: 'TUTELA', weight: 15, type: 'GENERIC' },
    ],
    MX: [
        { term: 'MEXICO', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'ESTADOS UNIDOS MEXICANOS', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'REPUBLICA MEXICANA', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'SCJN', weight: 90, type: 'COURT', exact: true },
        { term: 'SUPREMA CORTE DE JUSTICIA DE LA NACION', weight: 90, type: 'COURT' },
        { term: 'TRIBUNAL FEDERAL DE JUSTICIA ADMINISTRATIVA', weight: 85, type: 'COURT' },
        { term: 'TFJA', weight: 80, type: 'COURT', exact: true },
        { term: 'TRIBUNALES COLEGIADOS DE CIRCUITO', weight: 75, type: 'COURT' },
        { term: 'PLENOS REGIONALES', weight: 70, type: 'COURT' },
        { term: 'SEMANARIO JUDICIAL DE LA FEDERACION', weight: 80, type: 'CODE' },
        { term: 'LFPCA', weight: 80, type: 'CODE', exact: true },
        { term: 'CNPP', weight: 80, type: 'CODE', exact: true },
        { term: 'CNPCF', weight: 80, type: 'CODE', exact: true },
        { term: 'LEY DE AMPARO', weight: 80, type: 'CODE' },
        { term: 'JUICIO DE AMPARO', weight: 40, type: 'PROCEDURAL' },
        { term: 'AMPARO INDIRECTO', weight: 40, type: 'PROCEDURAL' },
        { term: 'AMPARO DIRECTO', weight: 40, type: 'PROCEDURAL' },
        { term: 'AMPARO', weight: 15, type: 'GENERIC' },
    ],
    ES: [
        { term: 'ESPANA', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'REINO DE ESPANA', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'TRIBUNAL SUPREMO', weight: 85, type: 'COURT' },
        { term: 'TRIBUNAL CONSTITUCIONAL', weight: 80, type: 'COURT' },
        { term: 'AUDIENCIA NACIONAL', weight: 85, type: 'COURT' },
        { term: 'AUDIENCIA PROVINCIAL', weight: 75, type: 'COURT' },
        { term: 'TRIBUNAL SUPERIOR DE JUSTICIA', weight: 70, type: 'COURT' },
        { term: 'LECRIM', weight: 85, type: 'CODE', exact: true },
        { term: 'LJCA', weight: 85, type: 'CODE', exact: true },
        { term: 'LEY 1/2000', weight: 80, type: 'CODE' },
        { term: 'LEY DE ENJUICIAMIENTO CIVIL', weight: 85, type: 'CODE' },
        { term: 'LEY DE ENJUICIAMIENTO CRIMINAL', weight: 85, type: 'CODE' },
        { term: 'LEY 39/2015', weight: 80, type: 'CODE' },
        { term: 'LEY 29/1998', weight: 80, type: 'CODE' },
        { term: 'COMUNIDAD AUTONOMA', weight: 30, type: 'GENERIC' },
    ],
    AR: [
        { term: 'ARGENTINA', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'REPUBLICA ARGENTINA', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'CSJN', weight: 90, type: 'COURT', exact: true },
        { term: 'CORTE SUPREMA DE JUSTICIA DE LA NACION', weight: 90, type: 'COURT' },
        { term: 'PROCURACION DEL TESORO DE LA NACION', weight: 85, type: 'COURT' },
        { term: 'CAMARA NACIONAL DE APELACIONES', weight: 75, type: 'COURT' },
        { term: 'CAMARA FEDERAL DE APELACIONES', weight: 75, type: 'COURT' },
        { term: 'CPCCN', weight: 85, type: 'CODE', exact: true },
        { term: 'CPPF', weight: 85, type: 'CODE', exact: true },
        { term: 'LEY 19.549', weight: 85, type: 'CODE' },
        { term: 'LEY 19549', weight: 85, type: 'CODE' },
        { term: 'LEY 16.986', weight: 80, type: 'CODE' },
        { term: 'RECURSO EXTRAORDINARIO FEDERAL', weight: 60, type: 'PROCEDURAL' },
        { term: 'CABA', weight: 25, type: 'GENERIC', exact: true },
    ],
    US: [
        { term: 'UNITED STATES', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'UNITED STATES OF AMERICA', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'ESTADOS UNIDOS', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'USA', weight: 95, type: 'COUNTRY', exact: true },
        { term: 'SCOTUS', weight: 95, type: 'COURT', exact: true },
        { term: 'SUPREME COURT OF THE UNITED STATES', weight: 95, type: 'COURT' },
        { term: 'UNITED STATES COURT OF APPEALS', weight: 85, type: 'COURT' },
        { term: 'CIRCUIT COURT', weight: 70, type: 'COURT' },
        { term: 'DISTRICT COURT', weight: 65, type: 'COURT' },
        { term: 'FRCP', weight: 85, type: 'CODE', exact: true },
        { term: 'FRCRP', weight: 85, type: 'CODE', exact: true },
        { term: 'U.S.C.', weight: 80, type: 'CODE' },
        { term: 'UNITED STATES CODE', weight: 85, type: 'CODE' },
        { term: 'ADMINISTRATIVE PROCEDURE ACT', weight: 75, type: 'CODE' },
        { term: 'STARE DECISIS', weight: 40, type: 'PROCEDURAL' },
        { term: 'WRIT OF CERTIORARI', weight: 50, type: 'PROCEDURAL' },
    ],
    PE: [
        { term: 'PERU', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'REPUBLICA DEL PERU', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'TRIBUNAL CONSTITUCIONAL DEL PERU', weight: 90, type: 'COURT' },
        { term: 'CORTE SUPREMA DE JUSTICIA DE LA REPUBLICA', weight: 90, type: 'COURT' },
        { term: 'CORTES SUPERIORES DE JUSTICIA', weight: 75, type: 'COURT' },
        { term: 'PLENO CASATORIO', weight: 80, type: 'COURT' },
        { term: 'LEY 27444', weight: 85, type: 'CODE' },
        { term: 'DECRETO LEGISLATIVO 957', weight: 85, type: 'CODE' },
        { term: 'DECRETO LEGISLATIVO 768', weight: 85, type: 'CODE' },
        { term: 'LEY 31307', weight: 80, type: 'CODE' },
        { term: 'NUEVO CODIGO PROCESAL CONSTITUCIONAL', weight: 80, type: 'CODE' },
    ],
    CL: [
        { term: 'CHILE', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'REPUBLICA DE CHILE', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'CORTE SUPREMA DE CHILE', weight: 95, type: 'COURT' },
        { term: 'TRIBUNAL CONSTITUCIONAL DE CHILE', weight: 90, type: 'COURT' },
        { term: 'CONTRALORIA GENERAL DE LA REPUBLICA', weight: 80, type: 'COURT' },
        { term: 'CGR', weight: 60, type: 'COURT', exact: true },
        { term: 'CORTES DE APELACIONES', weight: 75, type: 'COURT' },
        { term: 'LEY 19.880', weight: 85, type: 'CODE' },
        { term: 'LEY 19880', weight: 85, type: 'CODE' },
        { term: 'RECURSO DE PROTECCION', weight: 70, type: 'PROCEDURAL' },
        { term: 'RECLAMO DE ILEGALIDAD', weight: 65, type: 'PROCEDURAL' },
    ],
    EC: [
        { term: 'ECUADOR', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'REPUBLICA DEL ECUADOR', weight: 100, type: 'COUNTRY', exact: true },
        { term: 'CORTE NACIONAL DE JUSTICIA', weight: 90, type: 'COURT' },
        { term: 'CORTE CONSTITUCIONAL DEL ECUADOR', weight: 90, type: 'COURT' },
        { term: 'CORTES PROVINCIALES DE JUSTICIA', weight: 75, type: 'COURT' },
        { term: 'COGEP', weight: 85, type: 'CODE', exact: true },
        { term: 'COA', weight: 75, type: 'CODE', exact: true },
        { term: 'COIP', weight: 85, type: 'CODE', exact: true },
        { term: 'LOGJCC', weight: 80, type: 'CODE', exact: true },
        { term: 'ACCION EXTRAORDINARIA DE PROTECCION', weight: 75, type: 'PROCEDURAL' },
    ],
};

/* -------------------------------------------------------------------------- */
/* VALIDATION & STORAGE DEFENSA                                               */
/* -------------------------------------------------------------------------- */

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPack(value: unknown): value is JurisdictionPack {
    if (!isPlainObject(value)) return false;
    const pack = value as Partial<JurisdictionPack>;
    return (
        typeof pack.code === 'string' &&
        pack.code.trim().length > 0 &&
        typeof pack.name === 'string' &&
        typeof pack.country === 'string' &&
        typeof pack.flag === 'string' &&
        isPlainObject(pack.courtHierarchy) &&
        Array.isArray(pack.sourceHierarchyRanks) &&
        isPlainObject(pack.proceduralCodes) &&
        typeof pack.precedentDoctrine === 'string' &&
        isPlainObject(pack.keyTerminology)
    );
}

function sanitizeCustomPacks(value: unknown): Record<string, JurisdictionPack> {
    if (!isPlainObject(value)) return {};
    const result: Record<string, JurisdictionPack> = {};

    for (const [rawKey, candidate] of Object.entries(value)) {
        if (!isValidPack(candidate)) continue;
        const normalizedCode = normalizeJurisdictionCode(candidate.code || rawKey);
        if (!normalizedCode) continue;

        result[normalizedCode] = {
            ...candidate,
            code: normalizedCode,
            source: 'CUSTOM',
        };
    }
    return result;
}

// Códigos oficiales reservados para prevenir colisión con packs personalizados
const RESERVED_OFFICIAL_CODES = new Set<string>([
    'CO', 'MX', 'ES', 'AR', 'US', 'PE', 'CL', 'EC', 'GENERIC'
]);

export function isReservedJurisdictionCode(code: string): boolean {
    return RESERVED_OFFICIAL_CODES.has(normalizeJurisdictionCode(code));
}

// Umbral mínimo de puntaje para resolver una jurisdicción soberana específica
// Si solo hay términos genéricos débiles, se resuelve a GENERIC / FALLBACK
const MIN_DECISION_SCORE = 50;

export const ENGINE_VERSION = '2.1.0-sovereign';
export const CATALOG_VERSION = '2026.09';

/**
 * Servicio para gestionar la persistencia y carga de packs de jurisdicción personalizados.
 */
class JurisdictionRegistryService {
    private customPacks: Record<string, JurisdictionPack> = {};
    private readonly storageAvailable: boolean;

    constructor() {
        this.storageAvailable = this.checkStorageAvailable();
        this.loadFromStorage();
    }

    private checkStorageAvailable(): boolean {
        try {
            return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
        } catch {
            return false;
        }
    }

    private loadFromStorage(): void {
        if (!this.storageAvailable) return;
        try {
            const stored = window.localStorage.getItem('LAGP_CUSTOM_JURISDICTIONS');
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                this.customPacks = sanitizeCustomPacks(parsed);
            }
        } catch {
            this.customPacks = {};
        }
    }

    private persist(): boolean {
        if (!this.storageAvailable) return false;
        try {
            window.localStorage.setItem('LAGP_CUSTOM_JURISDICTIONS', JSON.stringify(this.customPacks));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retorna todos los packs.
     * REGLA DE PRECEDENCIA ESTRICTA:
     * OFFICIAL > CUSTOM > GENERIC.
     * Ningún custom pack puede sobreescribir un código canónico del sistema.
     */
    public getAllPacks(): Record<string, JurisdictionPack> {
        return { ...this.customPacks, ...JURISDICTION_PACKS };
    }

    public getPack(code: string): JurisdictionPack | undefined {
        const normalized = normalizeJurisdictionCode(code);
        if (!normalized) return undefined;
        // Los oficiales tienen precedencia absoluta sobre los personalizados
        return JURISDICTION_PACKS[normalized] || this.customPacks[normalized];
    }

    public saveCustomPack(pack: JurisdictionPack): void {
        if (!isValidPack(pack)) return;
        const code = normalizeJurisdictionCode(pack.code);
        // Rechazar códigos canónicos reservados y GENERIC
        if (!code || isReservedJurisdictionCode(code)) return;

        this.customPacks[code] = {
            ...pack,
            code,
            source: 'CUSTOM',
        };
        this.persist();
    }

    public deleteCustomPack(code: string): boolean {
        const normalized = normalizeJurisdictionCode(code);
        // Prohibir eliminación o alteración de códigos oficiales
        if (!normalized || isReservedJurisdictionCode(normalized)) {
            return false;
        }
        if (this.customPacks[normalized]) {
            delete this.customPacks[normalized];
            this.persist();
            return true;
        }
        return false;
    }
}

export const jurisdictionRegistryService = new JurisdictionRegistryService();

/* -------------------------------------------------------------------------- */
/* RESOLUTION ENGINE                                                          */
/* -------------------------------------------------------------------------- */

export const resolveJurisdiction = (textOrCode: string): JurisdictionResolution => {
    const raw = String(textOrCode || '').trim();
    if (!raw) {
        return {
            code: 'GENERIC',
            pack: JURISDICTION_PACKS.GENERIC,
            score: 0,
            confidence: 0,
            heuristicConfidence: 0,
            evidence: [],
            alternatives: [],
            ambiguous: false,
            method: 'FALLBACK',
            engineVersion: ENGINE_VERSION,
            catalogVersion: CATALOG_VERSION,
        };
    }

    const allPacks = jurisdictionRegistryService.getAllPacks();
    const normalizedCode = normalizeJurisdictionCode(raw);

    // 1. Coincidencia directa con código registrado (ej. 'CO', 'MX')
    if (allPacks[normalizedCode]) {
        return {
            code: normalizedCode,
            pack: allPacks[normalizedCode],
            score: 100,
            confidence: 1,
            heuristicConfidence: 1,
            evidence: [
                {
                    signal: normalizedCode,
                    type: 'CODE',
                    weight: 100,
                    matched: normalizedCode,
                },
            ],
            alternatives: [],
            ambiguous: false,
            method: 'DIRECT_CODE',
            engineVersion: ENGINE_VERSION,
            catalogVersion: CATALOG_VERSION,
        };
    }

    const normalizedText = normalizeJurisdictionText(raw);
    const scores = new Map<string, number>();
    const evidenceMap = new Map<string, JurisdictionEvidence[]>();

    // 2. Evaluación ponderada con discriminación de sub-señales (Maximal Matching)
    // Ordenamos señales por longitud decreciente para evitar conteo doble cuando una señal más específica ya coincide
    for (const [code, signals] of Object.entries(JURISDICTION_SIGNALS)) {
        // Separamos y ordenamos por longitud de término
        const sortedSignals = [...signals].sort((a, b) => b.term.length - a.term.length);
        const matchedLongerTerms: string[] = [];

        for (const signal of sortedSignals) {
            // Si una señal más larga ya hizo match y contiene este término, evitamos la redundancia
            // Ej: "CORTE SUPREMA DE JUSTICIA DE LA NACION" absorbe "CORTE SUPREMA DE JUSTICIA"
            const isSubsumed = matchedLongerTerms.some(longer => longer.includes(signal.term));
            if (isSubsumed) {
                continue;
            }

            const matches = signal.exact
                ? containsExactToken(normalizedText, signal.term)
                : normalizedText.includes(signal.term);

            if (matches) {
                matchedLongerTerms.push(signal.term);

                const currentScore = scores.get(code) || 0;
                scores.set(code, currentScore + signal.weight);

                const currentEvidence = evidenceMap.get(code) || [];
                currentEvidence.push({
                    signal: signal.term,
                    type: signal.type,
                    weight: signal.weight,
                    matched: signal.term,
                });
                evidenceMap.set(code, currentEvidence);
            }
        }
    }

    if (scores.size === 0) {
        return {
            code: 'GENERIC',
            pack: allPacks.GENERIC || JURISDICTION_PACKS.GENERIC,
            score: 0,
            confidence: 0,
            heuristicConfidence: 0,
            evidence: [],
            alternatives: [],
            ambiguous: false,
            method: 'FALLBACK',
            engineVersion: ENGINE_VERSION,
            catalogVersion: CATALOG_VERSION,
        };
    }

    // Ordenar por puntaje decreciente
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const [bestCode, bestScore] = ranked[0];
    const secondScore = ranked[1]?.[1] || 0;
    const bestEvidence = evidenceMap.get(bestCode) || [];

    // Verificación de suficiencia de evidencia:
    // Si el score más alto no alcanza MIN_DECISION_SCORE y no cuenta con al menos una señal fuerte de COUNTRY o COURT,
    // se abstiene de declarar falsamente una soberanía jurídica nacional y recurre al pack GENERIC.
    const hasStrongIdentifier = bestEvidence.some(ev => ev.type === 'COUNTRY' || ev.type === 'COURT');
    if (bestScore < MIN_DECISION_SCORE && !hasStrongIdentifier) {
        return {
            code: 'GENERIC',
            pack: allPacks.GENERIC || JURISDICTION_PACKS.GENERIC,
            score: bestScore,
            confidence: 0.15,
            heuristicConfidence: 0.15,
            evidence: bestEvidence.sort((a, b) => b.weight - a.weight),
            alternatives: ranked.map(([code, score]) => ({ code, score })),
            ambiguous: true,
            method: 'FALLBACK',
            engineVersion: ENGINE_VERSION,
            catalogVersion: CATALOG_VERSION,
        };
    }

    // Ambigüedad: si el segundo puntaje es al menos el 75% del primero y supera un umbral mínimo significativo
    const ambiguous = secondScore >= 60 && bestScore > 0 && secondScore / bestScore >= 0.75;
    const heuristicConfidence = Math.min(1, Number((bestScore / 180).toFixed(2)));

    const pack = allPacks[bestCode] || JURISDICTION_PACKS[bestCode] || JURISDICTION_PACKS.GENERIC;

    return {
        code: bestCode,
        pack,
        score: bestScore,
        confidence: heuristicConfidence,
        heuristicConfidence,
        evidence: bestEvidence.sort((a, b) => b.weight - a.weight),
        alternatives: ranked.slice(1, 4).map(([code, score]) => ({ code, score })),
        ambiguous,
        method: 'RULES',
        engineVersion: ENGINE_VERSION,
        catalogVersion: CATALOG_VERSION,
    };
};

/**
 * Resuelve el JurisdictionPack a partir del texto del caso o código.
 * Mantiene compatibilidad total con la API existente en toda la aplicación.
 */
export const resolveJurisdictionPack = (textOrCode: string): JurisdictionPack => {
    return resolveJurisdiction(textOrCode).pack;
};
