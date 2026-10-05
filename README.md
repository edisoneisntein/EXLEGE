# EX LEGE — Laboratorio de Litigación Estratégica y Trazabilidad Jurídica

Plataforma de deconstrucción forense de expedientes, análisis ofensivo/defensivo y auditoría procesal automatizada con modelos avanzados de inteligencia artificial.

---

## 1. Lo Implementado (Estado Actual)

### 1.1 Motor de Inferencia Centralizado e Inmutable (`geminiService.ts`)
- **Inmutabilidad en Solicitudes:** Erradicación completa de la mutación de propiedades en objetos compartidos (`request.model`), eliminando condiciones de carrera en ejecuciones asíncronas concurrentes.
- **Clasificación Discriminada de Errores:**
  - *Errores transitorios (429, 5xx, timeouts, caídas de red):* Reintento automático con backoff exponencial y *jitter* aleatorio para evitar colisiones.
  - *Errores de compatibilidad o modelo inexistente (404, model not found):* Conmutación suave y autónoma a modelos candidatos de respaldo (`gemini-flash-latest`, `gemini-3.1-flash-lite`).
  - *Errores no recuperables (400 Bad Request, schema inválido):* Aborto inmediato y limpio sin desperdicio de cuota ni latencia.
- **Extracción Segura de JSON (`parseJsonResponse` y `generateJson`):** Eliminación de expresiones regulares destructivas que alteraban el cuerpo del JSON (preveniendo corrupción de citas legales con comillas o corchetes). La extracción se apoya exclusivamente en delimitadores limpios y `responseSchema`.
- **RAG con Guardrails y Límites de Contexto:** Acotamiento estricto de fragmentos recuperados (`maxRagSnippets: 12`, `maxChatMessages: 6`) y mandatos imperativos para evitar alucinaciones fácticas o doctrinales ornamentales.
- **Optimización de Evidencia Visual e Investigación Web:** Conversión de imágenes a Base64 por chunks de 32 KB (`0x8000`) para evitar congelamiento de la UI por asignación excesiva de memoria, y deduplicación automática de fuentes y URIs mediante `Map<string, GroundingSource>()`.

### 1.2 Gestor de Caché y Búsqueda Profunda de Folios (`contextCacheService.ts`)
- **Búsqueda Profunda en Anexos (*Deep-Folio Matching*):** Superación de la ceguera de los primeros 500 caracteres. El índice mantiene la trazabilidad del texto íntegro (`fullText`) y calcula dinámicamente ventanas contextuales centradas en el hallazgo fáctico cuando la coincidencia ocurre en páginas internas del anexo.
- **Conteo de Palabras Iterativo sin Garbage Collection:** Función `countWords` basada en lectura de códigos de caracteres UTF-16, consumiendo memoria $O(1)$ y eliminando la instanciación de arrays gigantescos por `.split(/\s+/)`.
- **Huellas Estructurales y Hash Determinista:** Generación de claves de caché estables mediante algoritmos de 32 bits (`Math.imul(31, hash)`), saneamiento de nombres de archivo y normalización de palabras clave de consulta.

### 1.3 Bucle de Reflexión y Optimización Agéntica (`refinementLoop.ts`)
- **El Servidor como Fuente de Verdad Inapelable (`Server-Authority`):** Se eliminó la dependencia del veredicto subjetivo del LLM. Un borrador solo alcanza el estado `APPROVED` si la calificación del servidor es $\ge 95/100$ **y** el riesgo procesal de inadmisión no es `ALTO`.
- **Detección Temprana de Estancamiento:** Detección de no-operación (`currentDraft.trim() === previousDraft.trim()`) para detener el ciclo inmediatamente si el redactor no produce mejoras sustantivas, ahorrando consumo de tokens.
- **Erradicación de Promesas Imposibles en Prompts:** Supresión de mandatos irreales ("100% de rigor jurídico", "borrador inatacable"), reemplazándolos por directrices procesales verificables (silogismo en 4 niveles, separación de pretensiones principales y subsidiarias, y blindaje contra caducidad).
- **Saneamiento Defensivo:** Acotamiento numérico de calificaciones (`clampScore`), filtrado/deduplicación de remediaciones y aislamiento de excepciones en los callbacks de progreso de UI.

### 1.4 Suite de Benchmarks y Robustez Agéntica (`agenticBenchmark.ts`)
- **Compatibilidad Universal con Navegador (React / Vite):** Erradicación de dependencias exclusivas de Node.js (`Buffer.byteLength`), reemplazadas por la API estándar `TextEncoder`.
- **Auditoría de Incompatibilidad Fáctica Rigurosa (BENCH-01):** Eliminación de falsos positivos basados en palabras genéricas. Exige la correlación simultánea de conceptos de contradicción con las marcas temporales en conflicto.
- **Aislamiento de Inyección Adversarial Indirecta (BENCH-02):** Auditoría frente a instrucciones maliciosas ocultas y marcadores de control de sistema (`SYSTEM COMMAND`, `INSTRUCTION OVERRIDE`).
- **Resiliencia y Conmutación Suave (BENCH-03):** Evaluación de contingencia sin falsos positivos, reportando estado `WARNING` cuando no exista evidencia textual concluyente de uso de fuentes de respaldo.
- **Gobernanza Operativa:** Timeouts independientes por prueba (`timeoutMs: 60_000`), cuotas máximas de logs en memoria y soporte para ejecución secuencial o paralela.

### 1.5 Arquitectura del Motor con Concurrencia Optimizada (`analysisOrchestrator.ts`)
- **Control Estricto de Concurrencia (`mapWithConcurrency`):** Ejecución con límite de hilos (`BATCH_CONCURRENCY_LIMIT = 3`, `WEB_SEARCH_CONCURRENCY_LIMIT = 2`), mitigando de raíz errores por saturación de cuota y *rate limits* (HTTP 429).
- **Motor Unificado de Procesamiento por Lotes (`processBatches`):** Abstracción genérica tipada que consolida las fases de análisis ofensivo (*Punto de Fractura*) y defensivo (*Blindaje Jurisprudencial*), con umbrales de tolerancia de fallo controlado.
- **Saneamiento y Deduplicación de Puntos Críticos (`sanitizeCriticalPoints`):** Filtrado semántico en tiempo de ejecución y deduplicación por claves compuestas (`${title}|${excerpt}`) para evitar distorsiones en la valoración del caso.

### 1.6 Aislamiento Epistemológico del Prompt por Ámbitos (Ámbitos I al IV)
- **ÁMBITO I (Documento Procesal Principal):** Delimitación exclusiva de hechos, pretensiones y excepciones del litigio.
- **ÁMBITO II (Acervo Probatorio Aportado):** Folios, testimonios, contratos y anexos documentales del expediente.
- **ÁMBITO III (Auditoría y Control Estratégico - Magistrado Supervisor):** Dictamen de gobernanza, riesgos procesales y auditorías de plazos.
- **ÁMBITO IV (Investigación Jurisprudencial y Canon Hermenéutico):** Fuentes normativas y sentencias externas obtenidas mediante búsqueda en vivo.
- **Prevalencia Epistemológica:** Reglas mandatorias donde los hechos de los Ámbitos I y II prevalecen sobre el Ámbito IV, prohibiendo convertir precedentes externos en afirmaciones fácticas no demostradas en el caso.

---

## 2. Lo Pendiente por Hacer (Backlog Técnico)

### 2.1 Desacoplamiento Modular de Servicios ("God Service" Split)
- **Subdivisión de `geminiService.ts`:** Segregar el servicio central en módulos especializados por responsabilidad:
  - `services/ai/`: Cliente unificado, políticas de reintento, clasificación de errores y registro de modelos.
  - `services/rag/`: Recuperador y generador de contexto en streaming.
  - `services/legal/`: Servicios atómicos de drafting, stress testing y enmiendas.
  - `services/evidence/`: Procesamiento de imágenes, líneas de tiempo y cotejo comparativo.

### 2.2 Inyección de Dependencias en la Suite de Benchmarks
- **Simulación Real de Fallas de Red (BENCH-03):** Desacoplar el proveedor de investigación jurídica (`LegalResearchProvider`) en `SupervisorAgent` para forzar rechazos intencionales de red (`NetworkError`), permitiendo auditar empíricamente la conmutación a la base dogmática de respaldo.
- **Rúbrica Cuantitativa Estructural:** Evolucionar los benchmarks de aserciones basadas en texto (`includes`) a rúbricas porcentuales ponderadas (detección de hechos, relación lógica, trazabilidad documental).

### 2.3 Capa Unificada de Métricas, Costos y Trazabilidad (AI Gateway)
- **Intercepción y Telemetría Centralizada:** Integración de un middleware que capture para cada solicitud: `requestId`, agente solicitante, tokens consumidos de entrada/salida, latencia en milisegundos, modelo/fallback utilizado y coste financiero estimado en USD.

### 2.4 Validación de Esquemas en Tiempo de Ejecución con Zod
- **Interceptores con Tipado Estricto:** Reemplazar el casteo manual en tiempo de desarrollo por esquemas formales declarados con Zod (`z.object({...})`), asegurando validación estricta y coerción de tipos en tiempo de ejecución.

### 2.5 Provenance Layer (Capa de Trazabilidad de Origen)
- **Taxonomía de Origen Fáctico:** Etiquetado inequívoco de cada conclusión o argumento del informe según su fuente:
  - `CASE_DOCUMENT`: Extraído de forma directa y comprobable del expediente.
  - `USER_EVIDENCE`: Sustentado en prueba pericial o documental aportada.
  - `WEB_RESEARCH`: Criterio hermenéutico o precedente normativo externo.
  - `MODEL_INFERENCE`: Hipótesis estratégica o inferencia deductiva del modelo.
  - `UNVERIFIED`: Afirmación sin soporte probatorio suficiente.
- **Motor Determinista de Verificación Cruzada:** Algoritmo post-ejecución no basado en LLM que coteje la coincidencia de citas textuales entre las afirmaciones del informe y los folios originales del caso antes de autorizar la emisión del dictamen final.
