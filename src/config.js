// Configuración por variables de entorno (en Azure: App Settings; nunca secretos en el repositorio).
module.exports = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bicisegura',
  dbSsl: process.env.DB_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET || 'solo-para-desarrollo-local',
  runMigrations: process.env.RUN_MIGRATIONS !== 'false',
  seedDemo: process.env.SEED_DEMO === 'true',
  maxReportesPorHora: Number(process.env.MAX_REPORTES_HORA) || 10,
};
