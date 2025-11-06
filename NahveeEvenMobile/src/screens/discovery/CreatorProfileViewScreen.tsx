import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import { DiscoverStackParamList } from '../../types/navigation';
import { CreatorInfo } from '../../types/discovery';
import ProfileInfoCard from '../../components/profile/ProfileInfoCard';
import StatsCard from '../../components/profile/StatsCard';
import ContentItem from '../../components/discovery/ContentItem';
import { mockCreators, mockContent } from '../../data/mockDiscoveryData';

type CreatorProfileViewScreenProps = NativeStackScreenProps<DiscoverStackParamList, 'ViewCreatorProfile'>;

const CreatorProfileViewScreen: React.FC<CreatorProfileViewScreenProps> = ({ route }) => {
  const { creatorId } = route.params;
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { isCreatorFollowed, followCreator, unfollowCreator } = useDiscovery();
  
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [creatorContent, setCreatorContent] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'about'>('content');

  const isFollowing = creator ? isCreatorFollowed(creator.id) : false;

  useEffect(() => {
    loadCreatorData();
  }, [creatorId]);

  const loadCreatorData = () => {
    // In a real app, this would be an API call
    const foundCreator = mockCreators.find(c => c.id === creatorId);
    if (foundCreator) {
      setCreator(foundCreator);
      // Load creator's content
      const content = mockContent.filter(c => c.creatorId === creatorId);
      setCreatorContent(content);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      loadCreatorData();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!creator) return;
    
    try {
      if (isFollowing) {
        await unfollowCreator(creator.id);
      } else {
        await followCreator(creator.id);
      }
    } catch (error) {
      console.error('Follow toggle error:', error);
    }
  };

  const handleContentPress = (contentId: string) => {
    // TODO: Navigate to content player/viewer
    console.log('Navigate to content:', contentId);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      marginRight: 16,
      padding: 8,
    },
    backButtonText: {
      fontSize: 18,
      color: theme.colors.primary,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
    },
    followButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginLeft: 12,
    },
    followButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    followButtonInactive: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    followButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    followButtonTextActive: {
      color: 'white',
    },
    followButtonTextInactive: {
      color: theme.colors.primary,
    },
    scrollContent: {
      paddingBottom: 30,
    },
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginVertical: 20,
    },
    tab: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    activeTab: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
    activeTabText: {
      color: 'white',
    },
    contentSection: {
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 15,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 40,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 40,
    },
  });

  if (!creator) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Creator Profile</Text>
        </View>
        <Text style={styles.loadingText}>Loading creator profile...</Text>
      </SafeAreaView>
    );
  }

  const renderTabs = () => {
    const tabs = [
      { key: 'content' as const, label: 'Content' },
      { key: 'about' as const, label: 'About' },
    ];

    return (
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.activeTab,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderContent = () => {
    if (activeTab === 'about') {
      return (
        <View style={styles.contentSection}>
          <StatsCard stats={creator.stats} role={creator.role} />
        </View>
      );
    }

    return (
      <View style={styles.contentSection}>
        <Text style={styles.sectionTitle}>
          Content ({creatorContent.length})
        </Text>
        {creatorContent.length === 0 ? (
          <Text style={styles.emptyText}>
            No content available from this creator yet.
          </Text>
        ) : (
          creatorContent.map((item) => (
            <ContentItem
              key={item.id}
              content={item}
              onPress={() => handleContentPress(item.id)}
              showCreator={false}
            />
          ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{creator.name}</Text>
        <TouchableOpacity
          style={[
            styles.followButton,
            isFollowing ? styles.followButtonActive : styles.followButtonInactive,
          ]}
          onPress={handleFollowToggle}
        >
          <Text
            style={[
              styles.followButtonText,
              isFollowing ? styles.followButtonTextActive : styles.followButtonTextInactive,
            ]}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Creator Profile Info */}
        <ProfileInfoCard
          profile={{
            ...creator,
            // Convert CreatorInfo to UserProfile structure
            email: '', // Email not shown for other creators
            createdAt: creator.createdAt,
            updatedAt: creator.lastActiveAt || creator.createdAt,
          }}
          showEditButton={false}
        />

        {/* Tabs */}
        {renderTabs()}

        {/* Content */}
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CreatorProfileViewScreen;