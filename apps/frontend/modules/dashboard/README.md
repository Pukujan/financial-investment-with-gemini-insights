# Dashboard module (frontend)

Views exist **only** on the frontend. This module owns the dashboard screen.

| Layer | Files |
|-------|-------|
| **View** | `views/Dashboard.tsx` — React UI only |
| Controller | `controllers/useDashboardChart.ts` |
| Model (service) | `services/dashboardApi.ts` — chart + prediction API |

Depends on `market` (stocks) and `portfolio` (portfolio value card). Backend equivalents: `modules/market` + `modules/ai` (no views).
