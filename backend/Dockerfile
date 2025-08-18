# ✅ Base image
FROM node:18-alpine

# ✅ Create app directory
WORKDIR /app

# ✅ Install dependencies first (layer caching)
COPY package*.json ./
RUN npm install --production

# ✅ Copy app source code
COPY . .

# ✅ Set env (if not using docker-compose)
ENV NODE_ENV=production
ENV PORT=5000

# ✅ Expose port
EXPOSE 5000

# ✅ Start server
CMD ["node", "server.js"]
