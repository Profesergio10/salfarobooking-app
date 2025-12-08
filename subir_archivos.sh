#!/bin/bash

# Script para subir archivos actualizados a salfaro.cl vía FTP

echo "🚀 Subiendo archivos actualizados a salfaro.cl..."

# Usar curl para subir archivos vía FTP
curl -T "public/index.html" ftp://ftp.salfaro.cl/public_html/ --user admin@salfaro.cl:Cruzado.1988
curl -T "public/script.js" ftp://ftp.salfaro.cl/public_html/ --user admin@salfaro.cl:Cruzado.1988

echo "✅ Archivos subidos correctamente"
echo ""
echo "Ahora prueba tu página en:"
echo "https://salfaro.cl"
echo ""
echo "Recuerda abrir en modo incógnito (Cmd + Shift + N)"
