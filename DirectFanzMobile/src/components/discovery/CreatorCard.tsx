import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import { CreatorInfo } from '../../types/discovery';
import Avatar from '../profile/Avatar';

interface CreatorCardProps {
  creator: CreatorInfo;
  onPress?: () => void;
  style?: 'card' | 'list' | 'compact';
  showFollowButton?: boolean;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2; // For 2-column grid with padding

const CreatorCard: React.FC<CreatorCardProps> = ({
  creator,
  onPress,
  style = 'card',
  showFollowButton = true,
}) => {
  const { theme } = useTheme();
  const { followCreator, unfollowCreator, isCreatorFollowed } = useDiscovery();
  
  const isFollowing = isCreatorFollowed(creator.id);

  const handleFollowToggle = async () => {
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

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const styles = StyleSheet.create({
    // Card style (for grid view)
    cardContainer: {
      width: CARD_WIDTH,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    
    // List style (for search results)
    listContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    
    // Compact style (for recommendations)
    compactContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      width: 200,
      marginRight: 12,
    },
    
    avatarSection: {
      alignItems: 'center',
      marginBottom: 12,
    },
    
    listAvatarSection: {
      marginRight: 16,
    },
    
    compactAvatarSection: {
      marginRight: 12,
    },
    
    contentSection: {
      flex: 1,
      alignItems: 'center',
    },
    
    listContentSection: {
      flex: 1,
      alignItems: 'flex-start',
    },
    
    compactContentSection: {
      flex: 1,
      alignItems: 'flex-start',
    },
    
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    
    listNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    
    name: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    
    listName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    
    compactName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    
    artistName: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: 8,
    },
    
    listArtistName: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
      marginBottom: 4,
    },
    
    compactArtistName: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    
    verifiedBadge: {
      marginLeft: 6,
      fontSize: 14,
    },
    
    bio: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
      marginBottom: 12,
      numberOfLines: 2,
    },
    
    listBio: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
      marginBottom: 8,
      flex: 1,
    },
    
    genresContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: 12,
    },
    
    listGenresContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    
    genreTag: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 6,
      marginBottom: 4,
    },
    
    genreText: {
      fontSize: 10,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      marginBottom: 12,
    },
    
    listStatsContainer: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    
    statItem: {
      alignItems: 'center',
    },
    
    listStatItem: {
      alignItems: 'center',
      marginRight: 16,
    },
    
    statValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    
    listStatValue: {
      fontSize: 12,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    
    statLabel: {
      fontSize: 10,
      color: theme.colors.textSecondary,
    },
    
    followButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 80,
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
      fontSize: 12,
      fontWeight: '600',
    },
    
    followButtonTextActive: {
      color: 'white',
    },
    
    followButtonTextInactive: {
      color: theme.colors.primary,
    },
    
    subscriptionPrice: {
      fontSize: 10,
      color: theme.colors.success,
      fontWeight: '500',
      marginTop: 4,
    },
    
    rightSection: {
      alignItems: 'flex-end',
    },
  });

  if (style === 'list') {
    return (
      <TouchableOpacity style={styles.listContainer} onPress={onPress}>
        <View style={styles.listAvatarSection}>
          <Avatar
            uri={creator.avatar}
            name={creator.name}
            size="medium"
          />
        </View>
        
        <View style={styles.listContentSection}>
          <View style={styles.listNameRow}>
            <Text style={styles.listName}>{creator.name}</Text>
            {creator.verified && (
              <Text style={styles.verifiedBadge}>✅</Text>
            )}
          </View>
          
          {creator.artistName && (
            <Text style={styles.listArtistName}>{creator.artistName}</Text>
          )}
          
          {creator.bio && (
            <Text style={styles.listBio} numberOfLines={1}>
              {creator.bio}
            </Text>
          )}
          
          <View style={styles.listGenresContainer}>
            {creator.genres.slice(0, 2).map((genre, index) => (
              <View key={index} style={styles.genreTag}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.listStatsContainer}>
            <View style={styles.listStatItem}>
              <Text style={styles.listStatValue}>
                {formatNumber(creator.followerCount)}
              </Text>
              <Text style={styles.statLabel}>followers</Text>
            </View>
            
            <View style={styles.listStatItem}>
              <Text style={styles.listStatValue}>
                {formatNumber(creator.contentCount)}
              </Text>
              <Text style={styles.statLabel}>posts</Text>
            </View>
            
            {creator.hasSubscriptionTiers && creator.lowestTierPrice && (
              <View style={styles.listStatItem}>
                <Text style={styles.listStatValue}>
                  ${creator.lowestTierPrice}
                </Text>
                <Text style={styles.statLabel}>from</Text>
              </View>
            )}
          </View>
        </View>
        
        {showFollowButton && (
          <View style={styles.rightSection}>
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
        )}
      </TouchableOpacity>
    );
  }

  if (style === 'compact') {
    return (
      <TouchableOpacity style={styles.compactContainer} onPress={onPress}>
        <View style={styles.compactAvatarSection}>
          <Avatar
            uri={creator.avatar}
            name={creator.name}
            size="small"
          />
        </View>
        
        <View style={styles.compactContentSection}>
          <View style={styles.listNameRow}>
            <Text style={styles.compactName} numberOfLines={1}>
              {creator.name}
            </Text>
            {creator.verified && (
              <Text style={styles.verifiedBadge}>✅</Text>
            )}
          </View>
          
          {creator.artistName && (
            <Text style={styles.compactArtistName} numberOfLines={1}>
              {creator.artistName}
            </Text>
          )}
          
          <Text style={styles.statLabel}>
            {formatNumber(creator.followerCount)} followers
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Default card style
  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress}>
      <View style={styles.avatarSection}>
        <Avatar
          uri={creator.avatar}
          name={creator.name}
          size="large"
        />
      </View>
      
      <View style={styles.contentSection}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{creator.name}</Text>
          {creator.verified && (
            <Text style={styles.verifiedBadge}>✅</Text>
          )}
        </View>
        
        {creator.artistName && (
          <Text style={styles.artistName}>{creator.artistName}</Text>
        )}
        
        {creator.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {creator.bio}
          </Text>
        )}
        
        <View style={styles.genresContainer}>
          {creator.genres.slice(0, 2).map((genre, index) => (
            <View key={index} style={styles.genreTag}>
              <Text style={styles.genreText}>{genre}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatNumber(creator.followerCount)}
            </Text>
            <Text style={styles.statLabel}>followers</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatNumber(creator.contentCount)}
            </Text>
            <Text style={styles.statLabel}>posts</Text>
          </View>
        </View>
        
        {creator.hasSubscriptionTiers && creator.lowestTierPrice && (
          <Text style={styles.subscriptionPrice}>
            From ${creator.lowestTierPrice}/mo
          </Text>
        )}
        
        {showFollowButton && (
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
        )}
      </View>
    </TouchableOpacity>
  );
};

export default CreatorCard;