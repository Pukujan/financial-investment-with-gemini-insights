# Feature modules — MVC conventions

Each user-facing feature gets its own folder under `modules/` in **both** frontend and backend when it has distinct API surface or UI.

## View layer: frontend only

| App | Has `views/`? | Presentation |
|-----|---------------|--------------|
| **Frontend** | Yes — `modules/<feature>/views/` | React components |
| **Backend** | **No** | JSON via `utils/response.ts` |

Never add `views/` under `apps/backend`. Server “presentation” is the HTTP response body, built in controllers.

### Layer checklist by app

**Frontend module**

```
modules/<feature>/
  views/          ← UI only (React)
  controllers/    ← hooks / providers
  services/       ← API client (Model)
  index.ts
```

**Backend module**

```
modules/<feature>/
  routes/
  controllers/
  services/
  # no views/
```

## Current feature map

| Feature | Backend module | Frontend module | API prefix |
|---------|----------------|-----------------|------------|
| Health | `health` | — | `/api/health` |
| Market data | `market` | `market` | `/api/market` |
| Dashboard charts | `market` + `ai` | `dashboard` | `/api/market/...`, `/api/ai/...` |
| Stock comparison | `market` | `stock-comparison` | (uses market stocks) |
| News | `market` | `news` | `/api/market/news` |
| AI insights | `ai` | `ai-insights` | `/api/ai/insights` |
| Portfolio | `portfolio` | `portfolio` | `/api/portfolio` |

## Adding a new feature module

### Backend

1. Create `apps/backend/src/modules/<feature>/`
2. Add `services/<feature>Service.ts` — business logic only
3. Add `controllers/<feature>Controller.ts` — thin HTTP layer
4. Add `routes/<feature>Routes.ts` — Express router
5. Register in `src/routes/index.ts`
6. Add QA tests in `src/__tests__/qa/` or `modules/<feature>/__tests__/`

### Frontend

1. Create `apps/frontend/modules/<feature>/`
2. Add `services/<feature>Api.ts` — calls `shared/api/http.ts`
3. Add `controllers/use<Feature>.ts` or `<Feature>Provider.tsx`
4. Add `views/<Feature>.tsx` — UI only
5. Export from `index.ts`
6. Import in `App.tsx` from `@/modules/<feature>`

## Rules

- **Views (frontend only)** must not call `fetch` directly — use the module service.
- **Backend** must not contain React, JSX, or a `views/` folder.
- **Frontend services** must not import React.
- **Controllers** (hooks/providers on FE; Express handlers on BE) orchestrate flow and call services.
- **Shared UI** (`components/ui/`) stays outside feature modules.
- **Types** shared across apps live in `packages/shared`, not duplicated in modules.

## Splitting a module further

If a module grows (e.g. `ai` has insights + predictions), split services first:

```
modules/ai/
  services/
    insightsService.ts
    predictionService.ts
  controllers/
    insightsController.ts
    predictionController.ts
  routes/
    aiRoutes.ts          # mounts both controllers
```

Keep one route file per module unless the feature is large enough to become two modules (`ai-insights` vs `ai-predictions`).
