#!/usr/bin/env bash
# Infraestructura de BiciSegura Lima en Azure (Azure for Students). Ejecutar en Azure Cloud Shell (Bash):
#
#   RG=bicisegura-lima-az APP=bicisegura-lima bash infra/azure-setup.sh
#
# Crea solo lo necesario para el caso:
#   - App Service Plan Linux B1 + Web App Node 22 (HTTPS obligatorio, TLS 1.2, health check)
#   - Azure Database for PostgreSQL Flexible Server B1ms (SSL obligatorio, firewall: solo servicios de Azure)
#   - Application Insights (monitoreo)
set -euo pipefail
: "${RG:?Define RG (grupo de recursos)}"
: "${APP:?Define APP (nombre único de la web app)}"
REGION="${REGION:-$(az group show -n "$RG" --query location -o tsv)}"
PLAN="plan-${APP}"
DB="pg-${APP}"
DB_ADMIN="biciadmin"
DB_NAME="bicisegura"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | cut -c1-20)Aa1}"
JWT_SECRET="$(openssl rand -hex 32)"
az config set extension.use_dynamic_install=yes_without_prompt >/dev/null 2>&1 || true
echo ">> Región: $REGION"

echo ">> Proveedores"
for ns in Microsoft.Web Microsoft.DBforPostgreSQL Microsoft.Insights Microsoft.OperationalInsights; do
  az provider register --namespace "$ns" --wait >/dev/null
done

echo ">> PostgreSQL Flexible Server (5 a 10 minutos)"
if ! az postgres flexible-server show -g "$RG" -n "$DB" -o none 2>/dev/null; then
  az postgres flexible-server create -g "$RG" -n "$DB" -l "$REGION" \
    --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
    --admin-user "$DB_ADMIN" --admin-password "$DB_PASSWORD" --public-access 0.0.0.0 --yes -o none \
  || az postgres flexible-server create -g "$RG" -n "$DB" -l "$REGION" \
    --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
    --admin-user "$DB_ADMIN" --admin-password "$DB_PASSWORD" --yes -o none
fi
echo ">> Firewall de la BD: solo servicios de Azure (regla 0.0.0.0)"
az postgres flexible-server firewall-rule create -g "$RG" --server-name "$DB" --name PermitirServiciosAzure \
    --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none 2>/dev/null \
  || az postgres flexible-server firewall-rule create -g "$RG" --name "$DB" --rule-name PermitirServiciosAzure \
    --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none
az postgres flexible-server db show -g "$RG" --server-name "$DB" --name "$DB_NAME" -o none 2>/dev/null \
  || az postgres flexible-server db create -g "$RG" --server-name "$DB" --name "$DB_NAME" -o none

echo ">> Application Insights"
az monitor app-insights component show -g "$RG" -a "appi-${APP}" -o none 2>/dev/null \
  || az monitor app-insights component create -g "$RG" -a "appi-${APP}" -l "$REGION" --kind web -o none
APPI_CS=$(az monitor app-insights component show -g "$RG" -a "appi-${APP}" --query connectionString -o tsv)

echo ">> App Service B1 Linux + Web App Node 22"
az appservice plan show -g "$RG" -n "$PLAN" -o none 2>/dev/null \
  || az appservice plan create -g "$RG" -n "$PLAN" -l "$REGION" --is-linux --sku B1 -o none
az webapp show -g "$RG" -n "$APP" -o none 2>/dev/null \
  || az webapp create -g "$RG" -p "$PLAN" -n "$APP" --runtime "NODE:22-lts" -o none
az webapp update -g "$RG" -n "$APP" --https-only true -o none
az webapp config set -g "$RG" -n "$APP" --startup-file "npm start" --always-on true \
  --min-tls-version 1.2 --ftps-state Disabled -o none
az webapp config appsettings set -g "$RG" -n "$APP" -o none --settings \
  DATABASE_URL="postgres://${DB_ADMIN}:${DB_PASSWORD}@${DB}.postgres.database.azure.com:5432/${DB_NAME}" \
  DB_SSL=true JWT_SECRET="$JWT_SECRET" SEED_DEMO=true RUN_MIGRATIONS=true \
  APPLICATIONINSIGHTS_CONNECTION_STRING="$APPI_CS" ApplicationInsightsAgent_EXTENSION_VERSION='~3' \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false WEBSITE_WEBDEPLOY_USE_SCM=true
az webapp config set -g "$RG" -n "$APP" --generic-configurations '{"healthCheckPath": "/health"}' -o none

echo ">> Credenciales de publicación para GitHub Actions"
az resource update -g "$RG" --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies \
  --parent "sites/${APP}" -n scm --set properties.allow=true -o none

echo
echo "Listo: https://${APP}.azurewebsites.net"
echo "Contraseña de la BD (guárdala): ${DB_PASSWORD}"
echo "Publish profile para el secreto AZURE_WEBAPP_PUBLISH_PROFILE de GitHub:"
echo "  az webapp deployment list-publishing-profiles -g ${RG} -n ${APP} --xml"
