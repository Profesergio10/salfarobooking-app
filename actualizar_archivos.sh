#!/bin/bash

echo "🗑️  Eliminando archivos viejos del servidor..."

# Eliminar archivos viejos
curl -Q "DELE public_html/script.js" ftp://ftp.salfaro.cl/ --user admin@salfaro.cl:Cruzado.1988
curl -Q "DELE public_html/index.html" ftp://ftp.salfaro.cl/ --user admin@salfaro.cl:Cruzado.1988

echo "📤 Subiendo archivos nuevos..."

# Subir archivos nuevos
curl -T "public/index.html" ftp://ftp.salfaro.cl/public_html/ --user admin@salfaro.cl:Cruzado.1988
curl -T "public/script.js" ftp://ftp.salfaro.cl/public_html/ --user admin@salfaro.cl:Cruzado.1988

echo "✅ Archivos actualizados correctamente"
echo ""
echo "Ahora prueba en modo incógnito: https://salfaro.cl"
