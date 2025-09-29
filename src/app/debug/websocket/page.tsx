'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';

export default function WebSocketDebugPage() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  const [testMessage, setTestMessage] = useState('Hello from debug page!');

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const connectSocket = () => {
    if (socket) {
      socket.disconnect();
    }

    addLog('Attempting to connect to localhost:3001...');
    setConnectionStatus('Connecting...');

    const newSocket = io('http://localhost:3001', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      addLog(`✅ Connected with socket ID: ${newSocket.id}`);
      setConnectionStatus('Connected');
      setSocket(newSocket);
    });

    newSocket.on('disconnect', (reason) => {
      addLog(`❌ Disconnected: ${reason}`);
      setConnectionStatus('Disconnected');
    });

    newSocket.on('connect_error', (error) => {
      addLog(`🚨 Connection Error: ${error.message}`);
      setConnectionStatus('Error');
    });

    // Test messaging events
    newSocket.on('new_message', (message) => {
      addLog(`📨 Received message: ${JSON.stringify(message)}`);
    });

    newSocket.on('message_sent', (confirmation) => {
      addLog(`✅ Message sent: ${JSON.stringify(confirmation)}`);
    });

    newSocket.on('conversations_list', (conversations) => {
      addLog(`📋 Conversations received: ${conversations.length} conversations`);
    });
  };

  const sendTestMessage = () => {
    if (!socket || !socket.connected) {
      addLog('❌ Cannot send message: Socket not connected');
      return;
    }

    addLog('Sending test message...');
    socket.emit('send_message', {
      receiverId: 'test_user_123',
      content: testMessage,
      type: 'text'
    });
  };

  const getConversations = () => {
    if (!socket || !socket.connected) {
      addLog('❌ Cannot get conversations: Socket not connected');
      return;
    }

    addLog('Requesting conversations...');
    socket.emit('get_conversations');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">WebSocket Debug Console</h1>
          
          {/* Connection Status */}
          <div className="mb-6 p-4 rounded-lg bg-gray-100">
            <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                connectionStatus === 'Connected' ? 'bg-green-100 text-green-800' :
                connectionStatus === 'Connecting...' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {connectionStatus}
              </span>
              <button
                onClick={connectSocket}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {socket ? 'Reconnect' : 'Connect'} to localhost:3001
              </button>
            </div>
            {session && (
              <p className="text-sm text-gray-600 mt-2">
                User: {session.user?.email || 'No user session'}
              </p>
            )}
          </div>

          {/* Test Controls */}
          <div className="mb-6 p-4 rounded-lg bg-blue-50">
            <h2 className="text-lg font-semibold mb-3">Test Controls</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Message
                </label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter test message..."
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={sendTestMessage}
                  disabled={!socket || !socket.connected}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Send Test Message
                </button>
                <button
                  onClick={getConversations}
                  disabled={!socket || !socket.connected}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Get Conversations
                </button>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">Connection Logs</h2>
              <button
                onClick={clearLogs}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Clear Logs
              </button>
            </div>
            <div className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet. Click "Connect" to start debugging.</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Debug Instructions:</h3>
            <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
              <li>Make sure your WebSocket server is running: <code>node websocket-server.js</code></li>
              <li>Click "Connect" to establish a WebSocket connection to localhost:3001</li>
              <li>Check the logs for connection status and any errors</li>
              <li>Try sending a test message to see if the server responds</li>
              <li>Use "Get Conversations" to test if demo data is loaded</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}