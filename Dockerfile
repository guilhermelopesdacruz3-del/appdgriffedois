# Dockerfile para HospedeAqui
FROM node:20-alpine

WORKDIR /app

# Copia package files
COPY package*.json ./

# Instala dependências
RUN npm ci --only=production

# Copia código fonte
COPY . .

# Build
RUN npm run build

# Porta
EXPOSE 8787

# Start
CMD ["node", "dist/index.js"]