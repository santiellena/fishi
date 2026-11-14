import { TECHNIQUE_DEFINITIONS } from "./knowledge.js";
import type { AnalysisEmailInput, StaticFinding } from "./types.js";

interface Rule {
 id: string; title: string; technique: StaticFinding["technique"];
 pattern: RegExp; negatable?: boolean; explanation: string;
}
const clause = "[^.!?;\\n]{0,90}?";
const action = "(?:ingres[a-z]*|introduc[a-z]*|envia[a-z]*|compart[a-z]*|responde[a-z]*|solicit[a-z]*|pedi[a-z]*|pedir[a-z]*|necesit[a-z]*|complet[a-z]*|actualiz[a-z]*|enter|send|share|provide|reply|submit|upload|update|need|request|ask)";
const credentials = "(?:contrasena[s]?|clave[s]?|otp|codigo[s]? de (?:verificacion|autenticacion|seguridad)|password[s]?|passcode[s]?|verification code[s]?|authentication code[s]?)";
const money = "(?:cuenta[s]? bancaria[s]?|datos de pago|metodo de pago|tarjeta[s]?|cbu|bank account|bank details|payment details|payment method|credit card)";
const personal = "(?:datos personales|documento de identidad|dni|numero de documento|personal (?:data|information)|social security number|ssn|card details|datos de (?:tu |su |la )?tarjeta)";

export const STATIC_RULES: readonly Rule[] = [
 { id: "URGENCY", title: "Presión temporal o urgencia", technique: "URGENCY", negatable: true,
  pattern: /\b(?:urgente|urgentemente|inmediato|inmediatamente|hoy mismo|ahora mismo|ultima oportunidad|urgent|urgently|immediately|right now|act now|take action|final notice|last chance|within \d+ (?:minutes?|hours?)|en \d+ (?:minutos?|horas?))\b/gu,
  explanation: "Se observó una expresión de presión temporal; puede existir también en una comunicación legítima." },
 { id: "ACCOUNT_THREAT", title: "Amenaza de bloqueo o pérdida de datos", technique: "URGENCY", negatable: true,
  pattern: /\b(?:(?:tu|su|your|the) (?:cuenta|acceso|archivos|fotos|account|access|files|photos|videos)[^.!?;\n]{0,100}(?:bloque[a-z]*|suspend[a-z]*|cerrad[a-z]*|elimin[a-z]*|block[a-z]*|delet[a-z]*|disabled)|(?:bloque[a-z]*|suspend[a-z]*|elimin[a-z]*|block[a-z]*|delet[a-z]*)[^.!?;\n]{0,60}(?:cuenta|acceso|fotos|account|access|files|photos))\b/gu,
  explanation: "El texto anuncia pérdida de acceso o datos; no se comprobó que la amenaza sea real." },
 { id: "CREDENTIAL_REQUEST", title: "Solicitud de contraseña o código de verificación", technique: "CREDENTIAL_REQUEST", negatable: true,
  pattern: new RegExp(`\\b${action}\\b${clause}\\b${credentials}\\b`, "gu"),
  explanation: "Se observó un verbo de solicitud junto a credenciales; se excluyen negaciones simples cercanas." },
 { id: "FINANCIAL_REQUEST", title: "Transferencia o cambio de datos de pago", technique: "BEC", negatable: true,
  pattern: new RegExp(`\\b(?:transferencia[s]?|wire transfer[s]?|(?:cambi[a-z]*|nueva|nuevo|change|new|${action})\\b${clause}\\b${money})\\b`, "gu"),
  explanation: "Existe una referencia a transferencias o actualización de pagos. Debe verificarse por un canal conocido; no prueba BEC." },
 { id: "AUTHORITY_CLAIM", title: "Invocación de autoridad (no verifica identidad)", technique: "AUTHORITY",
  pattern: /\b(?:director|gerente|superior|soporte tecnico|recursos humanos|ceo|chief executive|manager|it support|human resources)\b/gu,
  explanation: "Se menciona un cargo o área; su identidad y legitimidad no se comprobaron." },
 { id: "SECRECY", title: "Petición de secreto o aislamiento", technique: "BEC",
  pattern: /\b(?:confidencial|secreto|no (?:avises|consultes|comentes)|keep (?:it|this) (?:a )?(?:secret|confidential)|do not (?:tell|discuss)|don't (?:tell|discuss)|strictly confidential)\b/gu,
  explanation: "El mensaje apela a confidencialidad o evita consultas. Una etiqueta de confidencialidad aislada puede ser legítima." },
 { id: "PERSONAL_DATA_REQUEST", title: "Solicitud de datos personales", technique: "PRETEXTING", negatable: true,
  pattern: new RegExp(`\\b${action}\\b${clause}\\b${personal}\\b`, "gu"),
  explanation: "Una solicitud aparece próxima a datos personales. Fishi no comprobó el portal ni la finalidad declarada." },
 { id: "PROMPT_INJECTION", title: "Instrucciones dirigidas a la IA", technique: "PROMPT_INJECTION", negatable: true,
  pattern: /\b(?:(?:ignora[a-z]*|ignore|disregard|olvida[a-z]*)[^.!?;\n]{0,70}(?:instrucciones|instructions)|(?:analizador|asistente automatico|assistant|agente|modelo|ia|ai)[^.!?;\n]{0,70}(?:debe|must|return|devolver|classify|clasifica[a-z]*)|(?:revela[a-z]*|reveal|print)[^.!?;\n]{0,50}(?:system prompt|prompt del sistema))\b/gu,
  explanation: "Se detectó una orden que podría manipular al analizador. Su presencia no demuestra que se haya ejecutado ni que el resto sea phishing." },
];

/** Case/accents/whitespace are folded only for matching; offsets recover original evidence. */
function searchable(text: string) {
 let folded = "";
 const starts: number[] = [], ends: number[] = [];
 let offset = 0;
 for (const character of text) {
  const end = offset + character.length;
  const value = character.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’‘]/g, "'").replace(/\s/gu, " ");
  if (!value && ends.length) ends[ends.length - 1] = end;
  for (const part of value) {
   if (part === " " && folded.endsWith(" ")) { ends[ends.length - 1] = end; continue; }
   folded += part;
   // The rule vocabulary is ASCII after folding; preserve UTF-16 index alignment for other characters.
   for (let i = 0; i < part.length; i++) { starts.push(offset); ends.push(end); }
  }
  offset = end;
 }
 return { folded, starts, ends };
}
function negatedBefore(text: string, start: number) {
 const prefix = text.slice(Math.max(0, start - 85), start);
 return /\b(?:no|nunca|jamas|never|do not|don't|not)\s+(?:(?:te|le|nos|se|es|is|are|son|sera|debes|debe|deberias|should|ever|please|will|would|vamos|va|a|you|to)\s+){0,5}$/.test(prefix);
}

export function analyzeStatic(email: AnalysisEmailInput): StaticFinding[] {
 const fields: [string, string][] = [["subject", email.subject], ["textBody", email.textBody], ["from", email.from]];
 const prepared = fields.map(([field, text]) => ({ field, text, ...searchable(text) }));
 const findings: StaticFinding[] = [];
 for (const rule of STATIC_RULES) {
  let found: StaticFinding | undefined;
  for (const input of prepared) {
   const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
   for (const match of input.folded.matchAll(pattern)) {
    if (rule.negatable && negatedBefore(input.folded, match.index)) continue;
    if (rule.id === "ACCOUNT_THREAT" && /\b(?:no (?:se |sera |esta |quedara )?|(?:is|are|will|has|have) not (?:be )?)(?:bloque[a-z]*|suspend[a-z]*|elimin[a-z]*|block[a-z]*|delet[a-z]*|disabled)\b/.test(match[0])) continue;
    const start = input.starts[match.index]!, end = input.ends[match.index + match[0].length - 1]!;
    const definition = TECHNIQUE_DEFINITIONS[rule.technique];
    found = { ruleId: rule.id, title: rule.title, technique: rule.technique, field: input.field,
     evidence: input.text.slice(start, end), explanation: rule.explanation,
     limitation: definition.limitation, referenceIds: [...definition.referenceIds] };
    break;
   }
   if (found) break;
  }
  if (found) findings.push(found);
 }
 return findings;
}
export const staticSignals = (email: AnalysisEmailInput) => analyzeStatic(email).map(finding => finding.title);
