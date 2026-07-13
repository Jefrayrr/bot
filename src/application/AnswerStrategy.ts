import { ApplicationProfile } from './ApplicationProfile.js';
import { QuestionCategory } from './QuestionClassifier.js';

export class AnswerStrategy {
  private profile: ApplicationProfile;

  constructor(profile: ApplicationProfile) {
    this.profile = profile;
  }

  getAnswer(
    category: QuestionCategory,
    label: string,
    options: string[],
  ): string | null {
    switch (category) {
      case 'experience':
        return this._experienceAnswer(label, options);
      case 'availability':
        return this._availabilityAnswer(options);
      case 'salary':
        return this._salaryAnswer(options);
      case 'visa':
        return this._visaAnswer(options);
      case 'location':
        return this._locationAnswer(options);
      case 'language':
        return this._languageAnswer(options);
      case 'education':
        return this._educationAnswer(options);
      case 'personal_info':
        return this._personalInfoAnswer(label, options);
      case 'demographic':
        return this._demographicAnswer(label, options);
      case 'portfolio':
        return this._portfolioAnswer(label);
      default:
        return null;
    }
  }

  private _selectFromOptions(answer: string, options: string[]): string | null {
    if (options.length === 0) return answer;

    const lowerAnswer = answer.toLowerCase();

    const exactMatch = options.find(o => o.toLowerCase() === lowerAnswer);
    if (exactMatch) return exactMatch;

    const partialMatch = options.find(o => o.toLowerCase().includes(lowerAnswer) || lowerAnswer.includes(o.toLowerCase()));
    if (partialMatch) return partialMatch;

    for (const opt of options) {
      const optLower = opt.toLowerCase();
      if (lowerAnswer.includes(optLower) || optLower.includes(lowerAnswer)) {
        return opt;
      }
    }

    return options[0];
  }

  private _experienceAnswer(label: string, options: string[]): string | null {
    const specificTech = [
      { patterns: [/react/i], value: '1' },
      { patterns: [/angular/i], value: '1' },
      { patterns: [/vue/i], value: '0' },
      { patterns: [/node/i], value: '1' },
      { patterns: [/java(?:script)?\b/i], value: '1' },
      { patterns: [/typescript/i], value: '1' },
      { patterns: [/sql|postgres|mysql/i], value: '1' },
      { patterns: [/python/i], value: '0' },
      { patterns: [/go|golang|rust/i], value: '0' },
      { patterns: [/php/i], value: '0' },
      { patterns: [/c#|\.net/i], value: '0' },
      { patterns: [/flutter|dart|kotlin|swift/i], value: '0' },
    ];

    for (const tech of specificTech) {
      if (tech.patterns.some(p => p.test(label))) {
        return this._selectFromOptions(tech.value, options);
      }
    }

    const generalYears = this.profile.yearsExperience;
    return this._selectFromOptions(generalYears, options);
  }

  private _availabilityAnswer(options: string[]): string | null {
    if (options.length > 0) {
      const daysOption = options.find(o => /\d+/.test(o) && /day|week|month|dia|semana|mes/i.test(o));
      if (daysOption) return daysOption;
    }
    return this._selectFromOptions(this.profile.noticePeriod, options);
  }

  private _salaryAnswer(options: string[]): string | null {
    const profileSalary = this.profile.salary;

    if (options.length > 0) {
      const matchingOption = options.find(o => {
        const num = parseInt(o.replace(/[^0-9]/g, ''), 10);
        const profileNum = parseInt(profileSalary.replace(/[^0-9]/g, ''), 10);
        return !isNaN(num) && !isNaN(profileNum) && Math.abs(num - profileNum) / profileNum < 0.5;
      });
      if (matchingOption) return matchingOption;

      const rangeOption = options.find(o => {
        const nums = o.match(/\d[\d,.]*/g);
        if (!nums) return false;
        const profileNum = parseInt(profileSalary.replace(/[^0-9]/g, ''), 10);
        const optionNums = nums.map(n => parseInt(n.replace(/[,.]/g, ''), 10)).filter(n => !isNaN(n));
        return optionNums.some(n => profileNum >= n * 0.5 && profileNum <= n * 2);
      });
      if (rangeOption) return rangeOption;

      return options[0];
    }

    return profileSalary;
  }

  private _visaAnswer(options: string[]): string | null {
    const answer = this.profile.authorizedToWork;

    if (options.length > 0) {
      if (/yes|si|sí/i.test(answer)) {
        const yesOption = options.find(o => /yes|si|sí/i.test(o));
        if (yesOption) return yesOption;
      } else {
        const noOption = options.find(o => /^no$/i.test(o) || o.toLowerCase().startsWith('no'));
        if (noOption) return noOption;
      }
      return options[0];
    }

    return answer;
  }

  private _locationAnswer(options: string[]): string | null {
    const city = this.profile.city;
    if (options.length > 0) {
      const cityLower = city.toLowerCase();
      const match = options.find(o => {
        const lower = o.toLowerCase();
        return cityLower.includes(lower) || lower.includes(cityLower) ||
          lower.includes('bogot') || lower.includes('colombia') ||
          lower.includes('remote') || lower.includes('remoto');
      });
      if (match) return match;
      return options[0];
    }
    return city;
  }

  private _languageAnswer(options: string[]): string | null {
    const level = this.profile.english.toLowerCase();

    if (options.length > 0) {
      const exactOption = options.find(o => o.toLowerCase() === level);
      if (exactOption) return exactOption;

      const levelOrder = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'basic', 'intermediate', 'advanced', 'native', 'fluent'];
      const currentIdx = levelOrder.findIndex(l => level.includes(l));
      for (const opt of options) {
        const optLower = opt.toLowerCase();
        const optIdx = levelOrder.findIndex(l => optLower.includes(l));
        if (optIdx >= 0 && (currentIdx < 0 || Math.abs(optIdx - currentIdx) <= 2)) {
          return opt;
        }
      }
      return options[0];
    }

    return this.profile.english;
  }

  private _educationAnswer(options: string[]): string | null {
    const educations = this.profile.education || [];
    if (options.length > 0) {
      for (const edu of educations) {
        const match = options.find(o => {
          const lower = o.toLowerCase();
          return edu.toLowerCase().includes(lower) || lower.includes(edu.toLowerCase());
        });
        if (match) return match;
      }
      const techOption = options.find(o => /technolog|technician|técnico|tecnólogo|tecnologo/i.test(o));
      if (techOption) return techOption;
      return options[0];
    }
    return educations.join(', ') || 'Technologist';
  }

  private _personalInfoAnswer(label: string, options: string[]): string | null {
    const labelLower = label.toLowerCase();

    if (/first.?name|nombre/.test(labelLower) && !/apellido|last/.test(labelLower) && !/completo|full/.test(labelLower)) {
      return this._selectFromOptions(this.profile.fullName.split(' ')[0] || '', options);
    }
    if (/last.?name|apellido/.test(labelLower)) {
      return this._selectFromOptions(this.profile.fullName.split(' ').slice(1).join(' ') || '', options);
    }
    if (/full.?name|nombre.*completo/.test(labelLower)) {
      return this._selectFromOptions(this.profile.fullName, options);
    }
    if (/email|correo/.test(labelLower)) {
      return this._selectFromOptions(this.profile.email, options);
    }
    if (/phone|teléfono|telefono|mobile|celular/.test(labelLower)) {
      return this._selectFromOptions(this.profile.phone, options);
    }

    return null;
  }

  private _demographicAnswer(label: string, options: string[]): string | null {
    const labelLower = label.toLowerCase();

    if (/hispanic|latinx|latin/.test(labelLower)) {
      return this._selectFromOptions('Yes', options);
    }
    if (/veteran/i.test(labelLower)) {
      return this._selectFromOptions('No', options);
    }
    if (/disability|discapacidad/i.test(labelLower)) {
      return this._selectFromOptions('No', options);
    }
    if (/gender|g[eé]nero/.test(labelLower)) {
      return this._selectFromOptions('', options);
    }
    if (/race|ethnicity|raza|etnia/.test(labelLower)) {
      return this._selectFromOptions('', options);
    }

    if (options.length > 0) {
      const preferNot = options.find(o => /prefer.*not|decline|skip/i.test(o));
      if (preferNot) return preferNot;
      return options[0];
    }

    return null;
  }

  private _portfolioAnswer(label: string): string | null {
    const labelLower = label.toLowerCase();

    if (/github/i.test(labelLower)) return this.profile.github || null;
    if (/linkedin/i.test(labelLower)) return this.profile.linkedin || null;
    if (/portfolio|portafolio/.test(labelLower)) return this.profile.portfolio || null;

    return this.profile.portfolio || this.profile.github || null;
  }
}
