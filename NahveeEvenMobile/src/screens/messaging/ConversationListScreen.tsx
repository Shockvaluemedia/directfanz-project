import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useMessaging } from '../../contexts/MessagingContext';
import { ConversationListItem } from '../../components/messaging';
import { Conversation, ConversationFilter } from '../../types/messaging';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

type ConversationListScreenNavigationProp = any; // Replace with proper navigation type

interface FilterOption {
  key: keyof ConversationFilter | 'all';
  label: string;
  icon: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'All', icon: 'chatbubbles' },
  { key: 'hasUnread', label: 'Unread', icon: 'mail-unread' },
  { key: 'type', label: 'Direct', icon: 'person' },
  { key: 'isArchived', label: 'Archived', icon: 'archive' },
];

const ConversationListScreen: React.FC = () => {
  const navigation = useNavigation<ConversationListScreenNavigationProp>();
  const { theme, colors } = useTheme();
  const styles = createStyles(colors, theme);
  const insets = useSafeAreaInsets();
  
  const {
    state,
    loadConversations,
    searchConversations,
    updateConversation,
    deleteConversation,
    getUnreadCount,
  } = useMessaging();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<keyof ConversationFilter | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    let conversations = state.conversationsList
      .map(id => state.conversations[id])
      .filter(Boolean);

    // Apply search filter
    if (searchQuery.trim()) {
      conversations = searchConversations(searchQuery.trim());
    }

    // Apply category filter
    if (activeFilter !== 'all') {
      conversations = conversations.filter(conv => {
        switch (activeFilter) {
          case 'hasUnread':
            return (conv.unreadCount || 0) > 0;
          case 'type':
            return conv.type === 'DIRECT';
          case 'isArchived':
            return conv.isArchived;
          default:
            return true;
        }
      });
    } else {
      // For 'all', exclude archived conversations
      conversations = conversations.filter(conv => !conv.isArchived);
    }

    return conversations;
  }, [state.conversations, state.conversationsList, searchQuery, activeFilter, searchConversations]);

  const totalUnreadCount = getUnreadCount();

  // Refresh conversations
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadConversations();
    } finally {
      setRefreshing(false);
    }
  };

  // Navigate to conversation
  const handleConversationPress = (conversation: Conversation) => {
    navigation.navigate('ChatScreen', { conversationId: conversation.id });
  };

  // Handle long press on conversation
  const handleConversationLongPress = (conversation: Conversation) => {
    Alert.alert(
      conversation.title || 'Conversation Options',
      'Choose an action',
      [
        {
          text: conversation.isMuted ? 'Unmute' : 'Mute',
          onPress: () => updateConversation(conversation.id, { isMuted: !conversation.isMuted }),
        },
        {
          text: conversation.isPinned ? 'Unpin' : 'Pin',
          onPress: () => updateConversation(conversation.id, { isPinned: !conversation.isPinned }),
        },
        {
          text: conversation.isArchived ? 'Unarchive' : 'Archive',
          onPress: () => updateConversation(conversation.id, { isArchived: !conversation.isArchived }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Conversation',
              'Are you sure you want to delete this conversation? This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteConversation(conversation.id),
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Start new conversation
  const handleNewConversation = () => {
    navigation.navigate('NewConversationScreen');
  };

  // Toggle search
  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery('');
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Render conversation item
  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const currentUserId = 'current_user_id'; // This should come from user context
    const typingUsers = state.typingIndicators[item.id] || [];
    const isOnline = item.type === 'DIRECT' && 
      item.participants.some(p => 
        p.userId !== currentUserId && state.onlineUsers.has(p.userId)
      );

    return (
      <ConversationListItem
        conversation={item}
        currentUserId={currentUserId}
        onPress={handleConversationPress}
        onLongPress={handleConversationLongPress}
        isOnline={isOnline}
        typingUsers={typingUsers.map(t => t.userId)}
      />
    );
  };

  // Render filter chip
  const renderFilterChip = (option: FilterOption) => {
    const isActive = activeFilter === option.key;
    const unreadCount = option.key === 'hasUnread' ? 
      Object.values(state.conversations).filter(c => (c.unreadCount || 0) > 0).length : 0;

    return (
      <TouchableOpacity
        key={option.key}
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={() => setActiveFilter(option.key)}
      >
        <Ionicons
          name={option.icon as any}
          size={16}
          color={isActive ? colors.onPrimary : colors.textSecondary}
          style={styles.filterIcon}
        />
        <Text style={[
          styles.filterText,
          isActive && styles.filterTextActive
        ]}>
          {option.label}
        </Text>
        {option.key === 'hasUnread' && unreadCount > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (state.isLoadingConversations) {
      return (
        <View style={styles.centered}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <EmptyState
          icon="search"
          title="No conversations found"
          message={`No conversations match "${searchQuery}"`}
          actionText="Clear search"
          onActionPress={clearSearch}
        />
      );
    }

    if (activeFilter !== 'all') {
      const filterOption = FILTER_OPTIONS.find(opt => opt.key === activeFilter);
      return (
        <EmptyState
          icon={filterOption?.icon as any || 'chatbubbles'}
          title={`No ${filterOption?.label.toLowerCase()} conversations`}
          message={`You don't have any ${filterOption?.label.toLowerCase()} conversations yet.`}
          actionText="View all"
          onActionPress={() => setActiveFilter('all')}
        />
      );
    }

    return (
      <EmptyState
        icon="chatbubbles-outline"
        title="No conversations yet"
        message="Start connecting with creators and fans by sending your first message."
        actionText="Start new conversation"
        onActionPress={handleNewConversation}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        {showSearch ? (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search conversations..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
                clearButtonMode="while-editing"
              />
            </View>
            <TouchableOpacity style={styles.cancelButton} onPress={toggleSearch}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Messages</Text>
              {totalUnreadCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton} onPress={toggleSearch}>
                <Ionicons name="search" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={handleNewConversation}>
                <Ionicons name="create" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Filter chips */}
      {!showSearch && (
        <View style={styles.filtersContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTER_OPTIONS}
            renderItem={({ item }) => renderFilterChip(item)}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.filtersContent}
          />
        </View>
      )}

      {/* Connection status */}
      {state.connectionStatus !== 'CONNECTED' && (
        <View style={[
          styles.connectionStatus,
          state.connectionStatus === 'CONNECTING' && styles.connectionStatusConnecting
        ]}>
          <Text style={styles.connectionStatusText}>
            {state.connectionStatus === 'CONNECTING' ? 'Connecting...' : 'Disconnected'}
          </Text>
        </View>
      )}

      {/* Conversation list */}
      <FlatList
        data={filteredConversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.conversationList}
      />

      {/* Error message */}
      {state.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating action button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleNewConversation}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: any, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Header styles
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginRight: 8,
  },
  headerBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: 16,
  },
  
  // Filter styles
  filtersContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterIcon: {
    marginRight: 4,
  },
  filterText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.onPrimary,
  },
  filterBadge: {
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Connection status
  connectionStatus: {
    backgroundColor: colors.error,
    paddingVertical: 4,
    alignItems: 'center',
  },
  connectionStatusConnecting: {
    backgroundColor: colors.warning,
  },
  connectionStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // List styles
  conversationList: {
    flex: 1,
  },
  
  // Empty state and loading
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  
  // Error styles
  errorContainer: {
    backgroundColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // FAB styles
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

export default ConversationListScreen;