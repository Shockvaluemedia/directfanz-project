#!/bin/bash

# DirectFanZ WebSocket Server Deployment Script
# This script helps deploy your WebSocket server to various cloud platforms

echo "🚀 DirectFanZ WebSocket Server Deployment"
echo "==========================================="

# Check if websocket-server.js exists
if [ ! -f "websocket-server.js" ]; then
    echo "❌ Error: websocket-server.js not found in current directory"
    exit 1
fi

echo ""
echo "Choose deployment option:"
echo "1) Railway (Recommended - Free tier available)"
echo "2) Render (Free tier available)" 
echo "3) Heroku (Paid)"
echo "4) DigitalOcean App Platform"
echo "5) Create Docker container for self-hosting"
echo ""

read -p "Select option (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🚂 Railway Deployment Instructions:"
        echo "====================================="
        echo "1. Install Railway CLI: npm install -g @railway/cli"
        echo "2. Login: railway login"
        echo "3. Create new project: railway new"
        echo "4. Deploy: railway up"
        echo ""
        echo "Railway will automatically detect your Node.js app and deploy it."
        echo "Your WebSocket server will be available at: https://your-app-name.railway.app"
        ;;
    2)
        echo ""
        echo "🎨 Render Deployment Instructions:"
        echo "================================="
        echo "1. Go to https://render.com"
        echo "2. Connect your GitHub repository"
        echo "3. Create a new Web Service"
        echo "4. Set build command: npm install"
        echo "5. Set start command: node websocket-server.js"
        echo "6. Set environment to Node.js"
        echo ""
        echo "Your WebSocket server will be available at: https://your-app-name.onrender.com"
        ;;
    3)
        echo ""
        echo "🟣 Heroku Deployment Instructions:"
        echo "================================="
        echo "1. Install Heroku CLI"
        echo "2. heroku login"
        echo "3. heroku create your-websocket-server"
        echo "4. git push heroku main"
        echo ""
        echo "Your WebSocket server will be available at: https://your-websocket-server.herokuapp.com"
        ;;
    4)
        echo ""
        echo "🌊 DigitalOcean App Platform Instructions:"
        echo "========================================"
        echo "1. Go to https://cloud.digitalocean.com/apps"
        echo "2. Create a new app from GitHub repository"
        echo "3. Configure as Node.js service"
        echo "4. Set run command: node websocket-server.js"
        echo ""
        ;;
    5)
        echo ""
        echo "🐳 Creating Docker configuration..."
        
        # Create Dockerfile
        cat > Dockerfile << EOF
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
EOF

        # Create docker-compose.yml
        cat > docker-compose.yml << EOF
version: '3.8'
services:
  websocket-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - WEBSOCKET_PORT=3001
    restart: unless-stopped
EOF

        echo "✅ Docker files created!"
        echo ""
        echo "To deploy with Docker:"
        echo "1. docker build -t directfanz-websocket ."
        echo "2. docker run -p 3001:3001 directfanz-websocket"
        echo ""
        echo "Or with docker-compose:"
        echo "1. docker-compose up -d"
        ;;
    *)
        echo "❌ Invalid option selected"
        exit 1
        ;;
esac

echo ""
echo "📝 Next Steps After Deployment:"
echo "==============================="
echo "1. Note your WebSocket server URL (e.g., https://your-server.railway.app)"
echo "2. Update your production app's environment variables:"
echo "   - NEXT_PUBLIC_WEBSOCKET_URL=wss://your-server.railway.app"
echo "3. Update socket-context.tsx to use production WebSocket URL"
echo "4. Redeploy your main app to Vercel"
echo ""
echo "🎉 Your messaging system will then work in production!"