export interface UserProfileData {
  name: string;
  education: string[];
  technicalSkills: string[];
  experience: string[];
  preferredLocations: string[];
  minimumSalary: number;
  employmentType: string;
  preferredRoles: string[];
  softSkills: string[];
}

export function loadUserProfile(): UserProfileData {
  return {
    name: 'Jefferson Rodriguez',

    education: [
      'Software Programming Technician',
      'Data Systematization Technologist',
      'Currently pursuing Telematics Engineering',
    ],

    technicalSkills: [
      'JavaScript',
      'TypeScript',
      'React',
      'Angular',
      'Node.js',
      'Express',
      'SQL',
      'MySQL',
      'PostgreSQL',
      'HTML',
      'CSS',
      'Git',
      'Linux',
      'REST APIs',
      'Power BI',
    ],

    experience: [
      'Full Stack Development',
      'Web Development',
      'Database Design',
      'Data Automation',
      'Forms Integration',
      'API Development',
    ],

    preferredLocations: ['Bogotá', 'Colombia', 'Remote'],

    minimumSalary: 3000000,

    employmentType: 'Full-Time',

    preferredRoles: ['Frontend Developer', 'Full Stack Developer', 'Backend Developer'],

    softSkills: ['Communication', 'Teamwork', 'Leadership', 'Problem Solving', 'Critical Thinking'],
  };
}
