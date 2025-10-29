# 🎬 DirectFanZ Live Streaming Setup

## 🚨 Quick Fix: Why "Start Stream" isn't working

The streaming functionality needs a **WebSocket server** for real-time communication. Here's how to get it working:

## 🎯 **Option 1: Local Development (Recommended)**

### 1. Start the WebSocket Server
```bash
# In terminal 1 - Start WebSocket server
node websocket-server.js
```

### 2. Start your Next.js app
```bash
# In terminal 2 - Start your main app
npm run dev
```

### 3. Test Streaming
1. Go to https://www.directfanz.io/dashboard/artist/livestreams
2. Click "Go Live" on your test stream
3. You should now see the streaming interface with camera controls!

## 🌐 **Option 2: Production Setup (Advanced)**

For production, you'll need a dedicated WebSocket server. Options:

### A. Railway/Render Deployment
1. Deploy `websocket-server.js` to Railway or Render
2. Get the deployment URL (e.g., `wss://your-app.up.railway.app`)
3. Update the components to use the production URL

### B. AWS EC2/DigitalOcean
1. Set up a VPS server
2. Run the WebSocket server with PM2
3. Use nginx as a reverse proxy

## 🔧 **Current Setup**

### What's Working:
✅ Database tables and API endpoints  
✅ Stream management interface  
✅ WebRTC broadcaster and viewer components  
✅ Stream scheduling and controls

### What Needs WebSocket Server:
❌ Real-time video streaming  
❌ Live chat during streams  
❌ Viewer count updates  
❌ Stream status synchronization

## 🎮 **Testing Steps (Once WebSocket is Running):**

1. **Start WebSocket Server:**
   ```bash
   node websocket-server.js
   # Should see: "🚀 DirectFanZ WebSocket Server running on port 3001"
   ```

2. **Open DirectFanZ:**
   - Go to livestreams dashboard
   - Click "Go Live" on your test stream
   - WebSocket should connect and show streaming interface

3. **Test Video:**
   - Allow camera/microphone permissions
   - Click "Start Stream" in the broadcaster interface
   - Open another tab to test viewer experience

## 📋 **Package.json Script (Optional)**

Add to your `package.json`:
```json
{
  "scripts": {
    "ws:dev": "node websocket-server.js",
    "dev:streaming": "concurrently \"npm run ws:dev\" \"npm run dev\""
  }
}
```

Then run: `npm run dev:streaming`

## 🐛 **Troubleshooting**

### "Start Stream" button not clickable:
- ✅ WebSocket server is running on port 3001
- ✅ Browser console shows no CORS errors
- ✅ Stream exists in database

### WebSocket connection fails:
- Check if port 3001 is available
- Verify CORS settings in `websocket-server.js`
- Ensure no firewall blocking port 3001

### Camera permissions issues:
- Use HTTPS (required for WebRTC)
- Allow camera/microphone permissions
- Test in Chrome/Firefox (best WebRTC support)

## 🎯 **Next Steps After WebSocket Setup:**

1. **Test Full Workflow:**
   - Broadcaster: Start stream with camera
   - Viewer: Watch stream in another browser
   - Chat: Send messages during stream
   - Tips: Test donation functionality

2. **Production Deployment:**
   - Deploy WebSocket server separately
   - Update environment variables
   - Test across different browsers/devices

3. **Enhanced Features:**
   - RTMP server for OBS integration
   - CDN for better global performance
   - Recording storage setup

## 🏆 **Result:**

Once the WebSocket server is running, you'll have **fully functional live streaming** with:
- ✅ Real-time video broadcast
- ✅ Interactive viewer experience
- ✅ Live chat capabilities  
- ✅ Tip/donation system
- ✅ Professional streaming controls

The "Go Live" button will open a complete streaming studio interface! 🎥