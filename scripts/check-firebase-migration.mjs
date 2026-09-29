// Keep incomplete hosting preparation from replacing the working Cloud Run site.
console.error("Firebase migration is not ready for deployment. The existing frontend still calls the Node /api endpoints. Complete the backend/auth migration and the verification checklist in docs/FIREBASE_SUPABASE_MIGRATION.md before replacing this guard with real readiness checks.");
process.exit(1);
