#!/bin/bash

echo "🎬 DirectFanZ Live Streaming Setup"
echo "=================================="

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

echo ""
echo "🚀 Starting DirectFanZ WebSocket server..."
echo "📡 WebSocket URL: http://localhost:3001/streaming"
echo "🌐 Platform URL: https://www.directfanz.io"
echo ""
echo "💡 Instructions:"
echo "   1. Keep this terminal open (WebSocket server)"
echo "   2. Open https://www.directfanz.io in your browser"
echo "   3. Go to: Dashboard → Live Streams"
echo "   4. Click 'Go Live' on your test stream"
echo "   5. Allow camera/microphone permissions"
echo "   6. Click 'Start Stream' to go live!"
echo ""
echo "⚠️  Press Ctrl+C to stop the server"
echo "=================================="
echo ""

# Start WebSocket server
node websocket-server.js