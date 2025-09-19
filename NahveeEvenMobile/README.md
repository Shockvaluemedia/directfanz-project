# Nahvee Even Mobile App

A React Native mobile application for the Nahvee Even creator platform, providing users with a native mobile experience for content creation, discovery, and community engagement.

## 🎯 Features

### Core Features

- **Authentication System**: Secure login/registration with AsyncStorage persistence
- **Multi-Role Support**: Different experiences for Artists, Fans, and Admins
- **Content Discovery**: Browse and discover creator content
- **Content Creation**: Upload and manage multimedia content
- **Analytics Dashboard**: Performance insights for creators
- **Media Player**: Audio/video playback with playlist support
- **Theme System**: Light/dark mode with system preference detection

### Technical Features

- **Navigation**: Stack and tab-based navigation with React Navigation
- **State Management**: Context API for global state (Auth, Theme, Player)
- **Offline Support**: Local storage with AsyncStorage
- **Performance**: Optimized with React Native best practices
- **Security**: Token-based authentication with secure storage

## 📱 App Structure

```
src/
├── contexts/          # Global state management
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── PlayerContext.tsx
├── navigation/        # Screen navigation
│   ├── AuthNavigator.tsx
│   ├── MainNavigator.tsx
│   └── [TabNavigators].tsx
├── screens/           # App screens
│   ├── auth/          # Authentication screens
│   ├── main/          # Main app screens
│   └── SplashScreen.tsx
├── types/            # TypeScript definitions
└── [other folders]   # Components, hooks, services, etc.
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- React Native development environment
- iOS: Xcode 14+ (for iOS development)
- Android: Android Studio (for Android development)

### Installation

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **iOS Setup** (macOS only)

   ```bash
   cd ios && pod install && cd ..
   ```

3. **Run the Application**

   For iOS:

   ```bash
   npx react-native run-ios
   ```

   For Android:

   ```bash
   npx react-native run-android
   ```

### Development Setup

1. **Start Metro Bundler**

   ```bash
   npx react-native start
   ```

2. **Enable Debugging**
   - Shake device or press Cmd+D (iOS) / Cmd+M (Android)
   - Select "Debug" to open Chrome DevTools

## 🔧 Configuration

### API Integration

Update API endpoints in contexts to match your backend:

```typescript
// In AuthContext.tsx - Update these URLs to match your web app
const API_BASE_URL = 'http://localhost:3000'; // Your Next.js app URL

const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
```

## 🎨 Key Components

### Authentication Flow

- **Loading**: Checking stored credentials
- **Unauthenticated**: Show auth screens (Welcome, Login, Register)
- **Authenticated**: Show main app with tab navigation

### Navigation Structure

- **Auth Stack**: Welcome → Login → Register → Forgot Password
- **Main Tabs**: Home, Discover, Upload, Profile, Analytics (for artists)
- **Nested Stacks**: Each tab has its own navigation stack

### State Management

```typescript
// Authentication
const { user, login, logout, isLoading } = useAuth();

// Theming
const { theme, toggleTheme, isDark } = useTheme();

// Media Player
const { play, pause, currentItem, isPlaying } = usePlayer();
```

## 🔍 Troubleshooting

### Common Issues

**Metro bundler issues:**

```bash
npx react-native start --reset-cache
```

**iOS build issues:**

```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

**Android build issues:**

```bash
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### Navigation Issues

- Ensure all screen components are properly exported
- Check that navigation parameter types match TypeScript definitions
- Verify context providers wrap the navigation container

## 📦 Key Dependencies

- **@react-navigation/native** - Navigation framework
- **@react-native-async-storage/async-storage** - Local storage
- **react-native-linear-gradient** - Gradient backgrounds
- **react-native-gesture-handler** - Touch gestures
- **react-native-reanimated** - Smooth animations
- **react-native-vector-icons** - Icon library
- **react-native-video** - Video playback
- **react-native-sound** - Audio playback

## 🤝 Development Notes

### Current Implementation Status

- ✅ Authentication system with secure storage
- ✅ Navigation structure with role-based tabs
- ✅ Theme system with light/dark mode
- ✅ Media player context for audio/video
- ✅ Splash screen and welcome flow
- 🔄 Screens are implemented as placeholders (ready for full implementation)
- 🔄 API integration ready (needs backend connection)

### Next Steps for Full Implementation

1. Complete authentication screens (Register, Forgot Password)
2. Implement content discovery and feed
3. Build upload functionality with media picker
4. Create detailed profile and settings screens
5. Integrate with backend API endpoints
6. Add push notifications
7. Implement offline caching
8. Add comprehensive testing

---

**Made with ❤️ for the Nahvee Even community**
