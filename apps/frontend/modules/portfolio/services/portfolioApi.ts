import type { PortfolioDocument } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const portfolioApi = {
  getPortfolio: () => http<PortfolioDocument>('/api/portfolio'),
  savePortfolio: (holdings: PortfolioDocument['holdings']) =>
    http<PortfolioDocument>('/api/portfolio', {
      method: 'PUT',
      body: JSON.stringify({ holdings }),
    }),
};
