FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose WebSocket port
EXPOSE 3001

# Start the server
CMD ["node", "websocket-server.js"]
