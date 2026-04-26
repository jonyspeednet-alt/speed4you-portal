# Movie Page Performance Fix - TODO
Status: [✅] 11/11 Complete

## Backend Optimizations (4 steps)
- [✅] 1. Edit backend/src/routes/content.js: Push `type` filter to `listItems({status:'published', type})`

- [✅] 2. Update backend/src/data/store.js: Add `sort` param support
- [✅] 3. Create DB migration: Add indexes on content_catalog (status,type,updated_at)
- [✅] 4. Test backend: `cd backend && node -e "console.time('load'); require('./src/data/store').listItems({type:'movie',status:'published'}).then(r=>{console.timeEnd('load');console.log('Movies:',r.items.length)})"`

## Frontend Infinite Scroll + Cache (5 steps)
- [✅] 5. Install @tanstack/react-query: `cd frontend && npm i @tanstack/react-query`
- [✅] 6. Add QueryProvider to frontend/src/main.jsx
- [✅] 7. Refactor frontend/src/pages/BrowsePage.jsx: useInfiniteQuery
- [✅] 8. Update frontend/src/services/contentService.js: Query-friendly
- [✅] 9. Add SWR headers to apiClient.js

## Validation & Deploy (2 steps)
- [✅] 10. Test /movies reload: <2s load
- [✅] 11. Deploy: one-click-deploy.bat

*All tasks completed successfully. Performance improvements deployed.*
