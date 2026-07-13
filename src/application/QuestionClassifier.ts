export type QuestionCategory =
  | 'experience'
  | 'availability'
  | 'salary'
  | 'visa'
  | 'location'
  | 'language'
  | 'education'
  | 'personal_info'
  | 'demographic'
  | 'portfolio'
  | 'unknown';

export interface ClassificationResult {
  category: QuestionCategory;
  confidence: number;
  signals: string[];
}

interface ScoringRule {
  category: QuestionCategory;
  strong: RegExp[];
  weak: RegExp[];
  contextCheck?: (options: string[], fieldType: string) => number;
  label: string;
}

const SCORING_RULES: ScoringRule[] = [
  {
    category: 'experience',
    strong: [
      /years?\s*(of)?\s*(react|angular|vue|node|java|python|javascript|typescript|sql)/i,
      /años?\s*(de)?\s*(react|angular|vue|node|java|python|javascript|typescript|sql)/i,
    ],
    weak: [
      /years?\s*(of)?\s*experience/i,
      /años?\s*(de)?\s*experiencia/i,
      /years?\s*of\s*profession/i,
      /work\s*experience/i,
      /relevant\s*experience/i,
      /how many years/i,
      /cuántos años/i,
      /cuantos años/i,
      /years\s*in\s*(role|position|field)/i,
    ],
    label: 'experience',
  },
  {
    category: 'availability',
    strong: [
      /notice.?period/i,
      /aviso.?previo/i,
      /start.?date/i,
      /start.?when/i,
      /available.*start/i,
      /fecha.*inicio/i,
      /disponibilidad/i,
      /incorporación/i,
      /incorporacion/i,
    ],
    weak: [
      /when can you start/i,
      /cuándo puedes empezar/i,
      /cuando puedes empezar/i,
      /available.*work/i,
      /earliest.*start/i,
    ],
    label: 'availability',
  },
  {
    category: 'salary',
    strong: [
      /(current|expected|desired)\s*salary/i,
      /salario/i,
      /compensación/i,
      /compensacion/i,
      /expectativa.*salarial/i,
      /salary.*expectation/i,
      /salary.*range/i,
    ],
    weak: [
      /compensation/i,
      /pay\s*range/i,
      /how much.*earn/i,
      /remuneration/i,
      /remuneración/i,
      /rango.*salarial/i,
      /cuánto.*ganas/i,
      /cuanto.*ganas/i,
      /sueldo/i,
    ],
    label: 'salary',
  },
  {
    category: 'visa',
    strong: [
      /sponsor/i,
      /visa/i,
      /work\s*authorization/i,
      /authorized.*work/i,
      /authorized.*employed/i,
      /right.*work/i,
      /employment\s*authorization/i,
      /require.*visa/i,
      /need.*visa/i,
    ],
    weak: [
      /legally.*work/i,
      /legally.*employed/i,
      /permit/i,
      /work.*permit/i,
      /citizen/i,
      /residency/i,
      /residence/i,
      /immigration/i,
      /immigrant/i,
    ],
    contextCheck: (options, fieldType) => {
      if (options.length <= 2 && options.some(o => /yes|no|si|sí/i.test(o))) return 20;
      return 0;
    },
    label: 'visa',
  },
  {
    category: 'location',
    strong: [
      /city/i,
      /ciudad/i,
      /location/i,
      /ubicación/i,
      /ubicacion/i,
      /what.*city/i,
      /what.*location/i,
    ],
    weak: [
      /where.*based/i,
      /dónde.*ubicad/i,
      /donde.*ubicad/i,
      /current.*location/i,
      /residence/i,
      /reside/i,
      /live/i,
      /vivir/i,
    ],
    label: 'location',
  },
  {
    category: 'language',
    strong: [
      /english/i,
      /inglés/i,
      /ingles/i,
      /language.*level/i,
      /nivel.*inglés/i,
      /nivel.*ingles/i,
      /idioma/i,
      /proficiency/i,
    ],
    weak: [
      /language/i,
      /speak/i,
      /write/i,
      /read/i,
      /fluent/i,
      /native/i,
    ],
    contextCheck: (options) => {
      if (options.some(o => /a1|a2|b1|b2|c1|c2|basic|intermediate|advanced|native|fluent/i.test(o))) return 30;
      return 0;
    },
    label: 'language',
  },
  {
    category: 'education',
    strong: [
      /education/i,
      /educación/i,
      /educacion/i,
      /degree/i,
      /título/i,
      /titulo/i,
      /level.*study/i,
      /nivel.*estudio/i,
      /highest.*degree/i,
    ],
    weak: [
      /university/i,
      /universidad/i,
      /college/i,
      /school/i,
      /escuela/i,
      /major/i,
      /field.*study/i,
      /graduat/i,
      /graduad/i,
      /bachelor/i,
      /master/i,
      /phd/i,
      /doctorad/i,
    ],
    label: 'education',
  },
  {
    category: 'personal_info',
    strong: [
      /first.?name/i,
      /last.?name/i,
      /full.?name/i,
      /nombre/i,
      /apellido/i,
    ],
    weak: [
      /email/i,
      /correo/i,
      /phone/i,
      /teléfono/i,
      /telefono/i,
      /mobile/i,
      /celular/i,
      /contact.*number/i,
      /date.*birth/i,
      /birth.*date/i,
      /fecha.*nacimiento/i,
      /gender/i,
      /género/i,
      /genero/i,
    ],
    label: 'personal_info',
  },
  {
    category: 'demographic',
    strong: [
      /race/i,
      /ethnicity/i,
      /raza/i,
      /etnia/i,
      /veteran/i,
      /disability/i,
      /discapacidad/i,
    ],
    weak: [
      /hispanic/i,
      /latinx/i,
      /latino/i,
      /protected.*veteran/i,
      /gender.*identity/i,
      /sexual.*orientation/i,
      /orientación/i,
      /diversity/i,
      /diversidad/i,
      /equal.*opportunity/i,
      /eeoc/i,
      /self.?identify/i,
    ],
    label: 'demographic',
  },
  {
    category: 'portfolio',
    strong: [
      /portfolio/i,
      /portafolio/i,
      /github/i,
      /linkedin/i,
      /personal.*site/i,
      /personal.*website/i,
      /sitio.*web/i,
      /pagina.*web/i,
    ],
    weak: [
      /website/i,
      /web/i,
      /url/i,
      /link.*profile/i,
      /online.*profile/i,
      /work.*sample/i,
      /muestra.*trabajo/i,
    ],
    label: 'portfolio',
  },
];

export class QuestionClassifier {
  classify(
    label: string,
    placeholder: string,
    options: string[],
    fieldType: string,
  ): ClassificationResult {
    const searchText = `${label} ${placeholder}`.toLowerCase();
    const scores: Map<QuestionCategory, { score: number; signals: string[] }> = new Map();

    for (const rule of SCORING_RULES) {
      let score = 0;
      const signals: string[] = [];

      for (const pattern of rule.strong) {
        if (pattern.test(searchText)) {
          score += 30;
          signals.push(`${rule.label}:strong:${pattern.source}`);
        }
      }

      for (const pattern of rule.weak) {
        if (pattern.test(searchText)) {
          score += 10;
          signals.push(`${rule.label}:weak:${pattern.source}`);
        }
      }

      if (rule.contextCheck) {
        const ctxScore = rule.contextCheck(options, fieldType);
        if (ctxScore > 0) {
          score += ctxScore;
          signals.push(`${rule.label}:context:+${ctxScore}`);
        }
      }

      if (options.length > 1) {
        for (const opt of options) {
          const optLower = opt.toLowerCase();
          for (const pattern of rule.strong) {
            if (pattern.test(optLower)) {
              score += 15;
              signals.push(`${rule.label}:option:${pattern.source}`);
              break;
            }
          }
        }
      }

      if (score > 0) {
        scores.set(rule.category, { score, signals });
      }
    }

    if (options.length <= 2 && options.length > 0) {
      const yesNo = options.some(o => /yes|no|si|sí/i.test(o));
      if (yesNo) {
        for (const [cat, data] of scores) {
          if (cat === 'visa' || cat === 'availability' || cat === 'experience') {
            scores.set(cat, { score: data.score + 5, signals: [...data.signals, 'global:yesno'] });
          }
        }
      }
    }

    let bestCategory: QuestionCategory = 'unknown';
    let bestScore = 0;
    let bestSignals: string[] = [];

    for (const [cat, data] of scores) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestCategory = cat;
        bestSignals = data.signals;
      }
    }

    if (bestScore < 10) {
      if (options.length > 0 && fieldType === 'select') {
        return { category: 'unknown', confidence: 5, signals: ['low score with options'] };
      }
      return { category: 'unknown', confidence: 5, signals: ['no classifier matched'] };
    }

    const confidence = Math.min(95, 20 + bestScore);
    return { category: bestCategory, confidence, signals: bestSignals };
  }

  getCategories(): QuestionCategory[] {
    return SCORING_RULES.map(r => r.category);
  }
}
