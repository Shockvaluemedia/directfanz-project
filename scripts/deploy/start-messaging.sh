#!/bin/bash

echo "💬 DirectFanZ Messaging System Setup"
echo "===================================="

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if required dependencies are installed  
if [ ! -d "node_modules/socket.io" ]; then
    echo "❌ Socket.IO not installed. Running npm install..."
    npm install socket.io
fi

# Initialize demo data
echo "🎭 Initializing demo conversations..."
node init-demo-conversations.js

echo ""
echo "🚀 Starting DirectFanZ WebSocket server for messaging..."
echo "📡 WebSocket URL: http://localhost:3001"
echo "💬 Messages Page: https://www.directfanz.io/messages"
echo ""
echo "💡 Instructions:"
echo "   1. Keep this terminal open (WebSocket server)"
echo "   2. Open https://www.directfanz.io/messages in browser"
echo "   3. Click 'Start Demo Chat' or open multiple browsers"
echo "   4. Send messages to test real-time messaging!"
echo ""
echo "🎮 Available Demo Users:"
echo "   • ArtistAlex (Artist)"
echo "   • MusicMia (Artist)" 
echo "   • FanSarah (Fan)"
echo "   • FanMike (Fan)"
echo ""
echo "⚠️  Press Ctrl+C to stop the server"
echo "===================================="
echo ""

# Start WebSocket server
node websocket-server.js