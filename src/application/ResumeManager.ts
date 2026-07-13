import fs from 'fs';
import { ApplicationProfile } from './ApplicationProfile.js';

export class ResumeManager {
  private profile: ApplicationProfile;

  constructor(profile: ApplicationProfile) {
    this.profile = profile;
  }

  getResumeForJob(title: string): string {
    const lower = title.toLowerCase();
    const isFrontend =
      /\bfront/.test(lower) && !/\bback/.test(lower);
    const isBackend =
      /\bback/.test(lower) && !/\bfront/.test(lower);
    const isFullStack =
      /\bfull.?stack/.test(lower) || (/\bfront/.test(lower) && /\bback/.test(lower));

    if (isFullStack) return this._resolvePath(this.profile.cvs.fullstack);
    if (isFrontend) return this._resolvePath(this.profile.cvs.frontend);
    if (isBackend) return this._resolvePath(this.profile.cvs.backend);

    return this._resolvePath(this.profile.cvs.general);
  }

  getAllResumes(): string[] {
    const paths = Object.values(this.profile.cvs);
    return paths.filter((p) => fs.existsSync(p));
  }

  hasAnyResume(): boolean {
    return Object.values(this.profile.cvs).some((p) => fs.existsSync(p));
  }

  private _resolvePath(filePath: string): string {
    if (fs.existsSync(filePath)) return filePath;
    const extensions = ['.pdf', '.doc', '.docx', '.txt'];
    for (const ext of extensions) {
      const alternative = filePath.replace(/\.\w+$/, '') + ext;
      if (fs.existsSync(alternative)) return alternative;
    }
    console.warn(`[ResumeManager] CV not found: ${filePath}`);
    return filePath;
  }
}
