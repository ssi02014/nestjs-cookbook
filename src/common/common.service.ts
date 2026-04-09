import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonService {
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
