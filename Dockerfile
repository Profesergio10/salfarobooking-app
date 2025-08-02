# Usa una imagen base de Node.js
FROM node:20-slim

# Establece el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copia los archivos package.json y package-lock.json
# para instalar las dependencias
COPY package*.json ./

# Instala las dependencias del proyecto
# --production asegura que solo se instalen las dependencias de producción
RUN npm install --production

# Copia el resto del código de la aplicación al contenedor
COPY . .

# Expone el puerto en el que tu aplicación Node.js escuchará (Cloud Run usa 8080 por defecto)
EXPOSE 8080

# Define el comando para iniciar la aplicación
CMD [ "node", "server.js" ]