export interface ApplicationProfile {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  linkedin: string;
  github: string;
  portfolio: string;
  salary: string;
  noticePeriod: string;
  visa: string;
  english: string;
  yearsExperience: string;
  authorizedToWork: string;
  currentlyEmployed: string;
  education: string[];
  cvs: {
    frontend: string;
    backend: string;
    fullstack: string;
    general: string;
  };
}

export function loadApplicationProfile(): ApplicationProfile {
  return {
    fullName: 'Jefferson Rodriguez',
    email: process.env.APPLICATION_EMAIL || 'jefray@email.com',
    phone: process.env.APPLICATION_PHONE || '+57 300 000 0000',
    city: 'Bogotá, Colombia',
    linkedin: process.env.APPLICATION_LINKEDIN || 'https://linkedin.com/in/jeffersonrodriguez',
    github: process.env.APPLICATION_GITHUB || 'https://github.com/jefray',
    portfolio: process.env.APPLICATION_PORTFOLIO || '',
    salary: process.env.APPLICATION_SALARY || '3000000',
    noticePeriod: process.env.APPLICATION_NOTICE || '15 days',
    visa: process.env.APPLICATION_VISA || 'No',
    english: process.env.APPLICATION_ENGLISH || 'A2',
    yearsExperience: process.env.APPLICATION_EXPERIENCE || '1',
    authorizedToWork: process.env.APPLICATION_AUTHORIZED || 'Yes',
    currentlyEmployed: process.env.APPLICATION_EMPLOYED || 'Yes',
    education: [
      'Technologist',
      'Software Programming Technician',
      'Data Systematization Technologist',
    ],
    cvs: {
      frontend: process.env.CV_FRONTEND || 'C:\\Users\\jefray\\Desktop\\CV_Frontend.pdf',
      backend: process.env.CV_BACKEND || 'C:\\Users\\jefray\\Desktop\\CV_Backend.pdf',
      fullstack: process.env.CV_FULLSTACK || 'C:\\Users\\jefray\\Desktop\\CV_FullStack.pdf',
      general: process.env.CV_GENERAL || 'C:\\Users\\jefray\\Desktop\\CV_General.pdf',
    },
  };
}
