import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  ScrollView,
  Switch,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PlaybackQuality, PlaybackSpeed } from '../../types/discovery';

interface PlaybackSettingsProps {
  visible: boolean;
  quality: PlaybackQuality;
  speed: PlaybackSpeed;
  onQualityChange: (quality: PlaybackQuality) => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onClose: () => void;
}

const PlaybackSettings: React.FC<PlaybackSettingsProps> = ({
  visible,
  quality,
  speed,
  onQualityChange,
  onSpeedChange,
  onClose,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'quality' | 'speed' | 'audio'>('quality');
  const [autoQuality, setAutoQuality] = useState(quality === 'auto');
  const [dataSaver, setDataSaver] = useState(false);
  const [skipSilence, setSkipSilence] = useState(false);
  const [normalizeAudio, setNormalizeAudio] = useState(true);
  
  const slideAnim = useRef(new Animated.Value(visible ? 0 : 100)).current;
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.large,
      borderTopRightRadius: theme.borderRadius.large,
      maxHeight: '80%',
      minHeight: '50%',
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginVertical: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonText: {
      fontSize: 18,
      color: theme.colors.textSecondary,
    },
    
    // Tabs
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.primary,
    },
    
    // Content
    content: {
      flex: 1,
      paddingTop: 20,
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    sectionDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    
    // Options
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.medium,
      marginBottom: 8,
      backgroundColor: theme.colors.background,
    },
    optionActive: {
      backgroundColor: theme.colors.primary + '15',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    optionLeft: {
      flex: 1,
      marginRight: 12,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    optionTitleActive: {
      color: theme.colors.primary,
    },
    optionDescription: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    optionRight: {
      alignItems: 'flex-end',
    },
    checkmark: {
      fontSize: 20,
      color: theme.colors.primary,
    },
    badge: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.small,
      marginTop: 4,
    },
    badgeText: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    
    // Switch Options
    switchOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.medium,
      marginBottom: 8,
      backgroundColor: theme.colors.background,
    },
    
    // Quality specific styles
    qualityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    qualityCard: {
      flex: 1,
      minWidth: '45%',
      maxWidth: '48%',
      padding: 16,
      borderRadius: theme.borderRadius.medium,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    qualityCardActive: {
      backgroundColor: theme.colors.primary + '15',
      borderColor: theme.colors.primary,
    },
    qualityLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    qualityLabelActive: {
      color: theme.colors.primary,
    },
    qualityRes: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    qualitySize: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    
    // Speed specific styles
    speedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    speedCard: {
      flex: 1,
      minWidth: '30%',
      maxWidth: '32%',
      padding: 16,
      borderRadius: theme.borderRadius.medium,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    speedCardActive: {
      backgroundColor: theme.colors.primary + '15',
      borderColor: theme.colors.primary,
    },
    speedLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    speedLabelActive: {
      color: theme.colors.primary,
    },
    speedDescription: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
    
    // Footer
    footer: {
      padding: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  // Quality options
  const qualityOptions = [
    { value: 'auto' as PlaybackQuality, label: 'Auto', resolution: 'Adaptive', size: 'Best for connection' },
    { value: '2160p' as PlaybackQuality, label: '4K', resolution: '2160p', size: '~15-25 GB/hr' },
    { value: '1440p' as PlaybackQuality, label: '2K', resolution: '1440p', size: '~9-18 GB/hr' },
    { value: '1080p' as PlaybackQuality, label: 'HD', resolution: '1080p', size: '~3-5 GB/hr' },
    { value: '720p' as PlaybackQuality, label: 'HD', resolution: '720p', size: '~1.5-3 GB/hr' },
    { value: '480p' as PlaybackQuality, label: 'SD', resolution: '480p', size: '~0.5-1 GB/hr' },
    { value: '360p' as PlaybackQuality, label: 'Low', resolution: '360p', size: '~0.3-0.7 GB/hr' },
    { value: '240p' as PlaybackQuality, label: 'Very Low', resolution: '240p', size: '~0.15-0.3 GB/hr' },
  ];

  // Speed options  
  const speedOptions = [
    { value: 0.25 as PlaybackSpeed, label: '0.25×', description: 'Very Slow' },
    { value: 0.5 as PlaybackSpeed, label: '0.5×', description: 'Slow' },
    { value: 0.75 as PlaybackSpeed, label: '0.75×', description: 'Slower' },
    { value: 1.0 as PlaybackSpeed, label: '1×', description: 'Normal' },
    { value: 1.25 as PlaybackSpeed, label: '1.25×', description: 'Faster' },
    { value: 1.5 as PlaybackSpeed, label: '1.5×', description: 'Fast' },
    { value: 1.75 as PlaybackSpeed, label: '1.75×', description: 'Very Fast' },
    { value: 2.0 as PlaybackSpeed, label: '2×', description: 'Ultra Fast' },
  ];

  // Animation effects
  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleQualitySelect = useCallback((selectedQuality: PlaybackQuality) => {
    onQualityChange(selectedQuality);
    setAutoQuality(selectedQuality === 'auto');
  }, [onQualityChange]);

  const handleSpeedSelect = useCallback((selectedSpeed: PlaybackSpeed) => {
    onSpeedChange(selectedSpeed);
  }, [onSpeedChange]);

  const handleAutoQualityToggle = useCallback((value: boolean) => {
    setAutoQuality(value);
    if (value) {
      handleQualitySelect('auto');
    } else {
      handleQualitySelect('1080p');
    }
  }, [handleQualitySelect]);

  const renderQualityTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video Quality</Text>
        <Text style={styles.sectionDescription}>
          Higher quality uses more data. Auto adjusts based on your connection speed.
        </Text>
        
        {/* Auto Quality Toggle */}
        <View style={styles.switchOption}>
          <View style={styles.optionLeft}>
            <Text style={styles.optionTitle}>Auto Quality</Text>
            <Text style={styles.optionDescription}>
              Automatically adjusts quality based on connection
            </Text>
          </View>
          <Switch
            value={autoQuality}
            onValueChange={handleAutoQualityToggle}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '50' }}
            thumbColor={autoQuality ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>

        {/* Data Saver Toggle */}
        <View style={styles.switchOption}>
          <View style={styles.optionLeft}>
            <Text style={styles.optionTitle}>Data Saver</Text>
            <Text style={styles.optionDescription}>
              Reduces video quality to save mobile data
            </Text>
          </View>
          <Switch
            value={dataSaver}
            onValueChange={setDataSaver}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '50' }}
            thumbColor={dataSaver ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Selection</Text>
        <View style={styles.qualityGrid}>
          {qualityOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.qualityCard,
                quality === option.value && styles.qualityCardActive,
                autoQuality && { opacity: 0.5 }
              ]}
              onPress={() => !autoQuality && handleQualitySelect(option.value)}
              disabled={autoQuality}
            >
              <Text style={[
                styles.qualityLabel,
                quality === option.value && styles.qualityLabelActive,
              ]}>
                {option.label}
              </Text>
              <Text style={styles.qualityRes}>{option.resolution}</Text>
              <Text style={styles.qualitySize}>{option.size}</Text>
              {quality === option.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderSpeedTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Playback Speed</Text>
        <Text style={styles.sectionDescription}>
          Adjust playback speed to watch content faster or slower. Audio pitch is maintained.
        </Text>
        
        <View style={styles.speedGrid}>
          {speedOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.speedCard,
                speed === option.value && styles.speedCardActive,
              ]}
              onPress={() => handleSpeedSelect(option.value)}
            >
              <Text style={[
                styles.speedLabel,
                speed === option.value && styles.speedLabelActive,
              ]}>
                {option.label}
              </Text>
              <Text style={styles.speedDescription}>{option.description}</Text>
              {speed === option.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderAudioTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audio Enhancement</Text>
        
        {/* Skip Silence */}
        <View style={styles.switchOption}>
          <View style={styles.optionLeft}>
            <Text style={styles.optionTitle}>Skip Silence</Text>
            <Text style={styles.optionDescription}>
              Automatically skip silent parts in audio content
            </Text>
          </View>
          <Switch
            value={skipSilence}
            onValueChange={setSkipSilence}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '50' }}
            thumbColor={skipSilence ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>

        {/* Audio Normalization */}
        <View style={styles.switchOption}>
          <View style={styles.optionLeft}>
            <Text style={styles.optionTitle}>Normalize Audio</Text>
            <Text style={styles.optionDescription}>
              Balance audio levels across different content
            </Text>
          </View>
          <Switch
            value={normalizeAudio}
            onValueChange={setNormalizeAudio}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '50' }}
            thumbColor={normalizeAudio ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audio Quality</Text>
        <Text style={styles.sectionDescription}>
          Higher quality provides better sound but uses more data.
        </Text>
        
        {[
          { value: 'lossless', label: 'Lossless', description: 'Highest quality, large files' },
          { value: '320kbps', label: 'High', description: '320 kbps - Excellent quality' },
          { value: '256kbps', label: 'Good', description: '256 kbps - Good balance' },
          { value: '128kbps', label: 'Standard', description: '128 kbps - Standard quality' },
          { value: '64kbps', label: 'Low', description: '64 kbps - Saves data' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              quality === option.value && styles.optionActive,
            ]}
            onPress={() => handleQualitySelect(option.value as PlaybackQuality)}
          >
            <View style={styles.optionLeft}>
              <Text style={[
                styles.optionTitle,
                quality === option.value && styles.optionTitleActive,
              ]}>
                {option.label}
              </Text>
              <Text style={styles.optionDescription}>
                {option.description}
              </Text>
            </View>
            {quality === option.value && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.modalContainer,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: [0, 500],
                })
              }]
            }
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Playback Settings</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            {[
              { key: 'quality' as const, label: 'Quality' },
              { key: 'speed' as const, label: 'Speed' },
              { key: 'audio' as const, label: 'Audio' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          {activeTab === 'quality' && renderQualityTab()}
          {activeTab === 'speed' && renderSpeedTab()}
          {activeTab === 'audio' && renderAudioTab()}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Settings are saved automatically and apply to future playback
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default PlaybackSettings;