#!/usr/bin/env bash
# Endurecimiento de seguridad de BiciSegura Lima en Azure (ejecutar DESPUÉS de azure-setup.sh, en Azure Cloud Shell Bash):
#
#   RG=bicisegura-lima-az APP=bicisegura-lima [ALERT_EMAIL=tu@correo] bash infra/azure-seguridad.sh
#
# Qué agrega (concepto del curso -> servicio de Azure). Todo entra en Azure for Students (sin costo fijo):
#   1. HTTPS y transporte seguro -> App Service: solo HTTPS, TLS 1.2 mínimo, FTP apagado, sin depuración remota
#   2. Gestor de secretos (keys)  -> Azure Key Vault guarda DATABASE_URL y JWT_SECRET; la app los lee por referencia
#   3. IAM (privilegio mínimo)    -> identidad administrada de la app con el único rol "Key Vault Secrets User"
#   4. Firewall de la BD          -> PostgreSQL: solo servicios de Azure (regla 0.0.0.0), SSL obligatorio, TLS 1.2
#   5. Monitor                    -> logs de App Service + alerta de errores 5xx (Application Insights ya existe)
# Si la app no arranca leyendo Key Vault, el script devuelve los valores originales (la app no se queda caída).
set -euo pipefail
: "${RG:?Define RG (grupo de recursos)}"
: "${APP:?Define APP (nombre de la web app)}"
DB="pg-${APP}"
KV="${KV:-kv-$(echo "${APP}" | tr -cd 'a-z0-9-' | cut -c1-21)}"
URL="https://${APP}.azurewebsites.net"
az config set extension.use_dynamic_install=yes_without_prompt >/dev/null 2>&1 || true
REGION=$(az group show -n "$RG" --query location -o tsv)
WEB_ID=$(az webapp show -g "$RG" -n "$APP" --query id -o tsv)
az provider register --namespace Microsoft.KeyVault --wait >/dev/null

echo ">> 1. App Service: HTTPS obligatorio, TLS 1.2, FTP apagado, sin depuración remota"
az webapp update -g "$RG" -n "$APP" --https-only true --client-affinity-enabled false -o none
az webapp config set -g "$RG" -n "$APP" --min-tls-version 1.2 --ftps-state Disabled \
  --http20-enabled true --remote-debugging-enabled false -o none
# FTP con usuario/clave: apagado. SCM (Kudu) queda activo porque GitHub Actions despliega con el publish profile.
az resource update -g "$RG" --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies \
  --parent "sites/${APP}" -n ftp --set properties.allow=false -o none

echo ">> 2 y 3. Key Vault + identidad administrada de la app (IAM con privilegio mínimo)"
az keyvault show -g "$RG" -n "$KV" -o none 2>/dev/null || \
  az keyvault create -g "$RG" -n "$KV" -l "$REGION" --enable-rbac-authorization true --retention-days 7 -o none
KV_ID=$(az keyvault show -g "$RG" -n "$KV" --query id -o tsv)
YO=$(az ad signed-in-user show --query id -o tsv)
az role assignment create --assignee-object-id "$YO" --assignee-principal-type User \
  --role "Key Vault Secrets Officer" --scope "$KV_ID" -o none 2>/dev/null || true
APP_PID=$(az webapp identity assign -g "$RG" -n "$APP" --query principalId -o tsv)
az role assignment create --assignee-object-id "$APP_PID" --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" --scope "$KV_ID" -o none 2>/dev/null || true

valor() { az webapp config appsettings list -g "$RG" -n "$APP" --query "[?name=='$1'].value | [0]" -o tsv; }
guardar() { # el permiso RBAC tarda unos minutos en propagarse: se reintenta
  for i in $(seq 1 16); do
    az keyvault secret set --vault-name "$KV" -n "$1" --value "$2" -o none 2>/dev/null && return 0
    echo "   esperando permisos en Key Vault ($i/16)..."; sleep 15
  done
  echo "No se pudo guardar $1 en Key Vault"; return 1
}
declare -A SECRETOS=( [DATABASE_URL]=database-url [JWT_SECRET]=jwt-secret )
declare -A ORIGINAL=()
AJUSTES=()
for AJUSTE in "${!SECRETOS[@]}"; do
  ACTUAL=$(valor "$AJUSTE")
  if [[ "$ACTUAL" == @Microsoft.KeyVault* ]]; then echo "   $AJUSTE ya apunta a Key Vault"; continue; fi
  ORIGINAL[$AJUSTE]="$ACTUAL"
  guardar "${SECRETOS[$AJUSTE]}" "$ACTUAL"
  AJUSTES+=("$AJUSTE=@Microsoft.KeyVault(VaultName=${KV};SecretName=${SECRETOS[$AJUSTE]})")
done

echo ">> 4. PostgreSQL: firewall solo para servicios de Azure, SSL obligatorio y TLS 1.2"
# Azure CLI 2.87 usa --server-name (servidor) y --name (regla); versiones anteriores, --name y --rule-name.
REGLAS=$(az postgres flexible-server firewall-rule list -g "$RG" --server-name "$DB" --query "[].name" -o tsv 2>/dev/null \
  || az postgres flexible-server firewall-rule list -g "$RG" --name "$DB" --query "[].name" -o tsv)
for REGLA in $REGLAS; do
  [ "$REGLA" = "PermitirServiciosAzure" ] && continue
  echo "   quitando regla abierta: $REGLA"
  az postgres flexible-server firewall-rule delete -g "$RG" --server-name "$DB" --name "$REGLA" --yes -o none 2>/dev/null \
    || az postgres flexible-server firewall-rule delete -g "$RG" --name "$DB" --rule-name "$REGLA" --yes -o none
done
echo "   reglas del firewall: $(echo $REGLAS | tr ' ' ',')"
az postgres flexible-server parameter set -g "$RG" --server-name "$DB" --name require_secure_transport --value on -o none
az postgres flexible-server parameter set -g "$RG" --server-name "$DB" --name ssl_min_protocol_version --value TLSv1.2 -o none
az postgres flexible-server parameter set -g "$RG" --server-name "$DB" --name log_connections --value on -o none

echo ">> 5. Monitor: logs de la app y alerta de errores 5xx"
az webapp log config -g "$RG" -n "$APP" --application-logging filesystem --web-server-logging filesystem \
  --detailed-error-messages true --level warning -o none
ACCION=()
if [ -n "${ALERT_EMAIL:-}" ]; then
  az monitor action-group create -g "$RG" -n "ag-${APP}" --short-name alertas --action email equipo "$ALERT_EMAIL" -o none
  ACCION=(--action "ag-${APP}")
fi
az monitor metrics alert show -g "$RG" -n "errores-5xx-${APP}" -o none 2>/dev/null || \
  az monitor metrics alert create -g "$RG" -n "errores-5xx-${APP}" --scopes "$WEB_ID" \
    --condition "total Http5xx > 5" --window-size 5m --evaluation-frequency 1m --severity 2 \
    --description "Más de 5 errores de servidor en 5 minutos" "${ACCION[@]}" -o none

if [ ${#AJUSTES[@]} -gt 0 ]; then
  echo ">> Cambiando los secretos de la app por referencias a Key Vault y reiniciando"
  az webapp config appsettings set -g "$RG" -n "$APP" --settings "${AJUSTES[@]}" -o none
fi
az webapp restart -g "$RG" -n "$APP" -o none

echo ">> Verificando que la app lea la BD con la cadena que viene de Key Vault (hasta 4 min)"
OK=no
for i in $(seq 1 24); do
  if curl -fsS -m 10 "$URL/health" 2>/dev/null | grep -q '"db":"ok"'; then OK=si; break; fi
  sleep 10
done
if [ "$OK" = no ] && [ ${#ORIGINAL[@]} -gt 0 ]; then
  echo "!! La app no respondió con Key Vault. Se restauran los valores originales para no dejarla caída."
  RESTAURAR=(); for K in "${!ORIGINAL[@]}"; do RESTAURAR+=("$K=${ORIGINAL[$K]}"); done
  az webapp config appsettings set -g "$RG" -n "$APP" --settings "${RESTAURAR[@]}" -o none
  az webapp restart -g "$RG" -n "$APP" -o none
  echo "   Revisa en el portal: ${APP} > Variables de entorno > estado de la referencia de Key Vault."
  exit 1
fi

cat <<FIN

Listo. Seguridad aplicada:
  $URL/health -> db: ok (la cadena de conexión ahora viene de Key Vault)
  http://${APP}.azurewebsites.net redirige a HTTPS
Evidencias para el informe (capturas del portal):
  ${APP} > Configuración > Variables de entorno: DATABASE_URL y JWT_SECRET con "Referencia de Key Vault" en verde
  ${APP} > Identidad: identidad administrada activada
  ${KV} > Control de acceso (IAM): la app con el rol "Key Vault Secrets User"
  ${APP} > Configuración > Configuración general: solo HTTPS, TLS 1.2, FTP deshabilitado
  ${DB} > Redes: solo "Permitir acceso público desde cualquier servicio de Azure"; Parámetros: require_secure_transport = on
  ${APP} > Alertas: regla errores-5xx-${APP}
FIN
