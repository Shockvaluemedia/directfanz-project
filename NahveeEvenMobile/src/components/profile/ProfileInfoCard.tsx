import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProfile, SocialLinks } from '../../types/profile';
import Avatar from './Avatar';

interface ProfileInfoCardProps {
  profile: UserProfile;
  onEditPress?: () => void;
  onAvatarPress?: () => void;
  showEditButton?: boolean;
}

const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({
  profile,
  onEditPress,
  onAvatarPress,
  showEditButton = true,
}) => {
  const { theme } = useTheme();

  const handleSocialLinkPress = async (platform: keyof SocialLinks, handle?: string) => {
    if (!handle) return;

    let url = '';
    switch (platform) {
      case 'instagram':
        url = `https://instagram.com/${handle.replace('@', '')}`;
        break;
      case 'twitter':
        url = `https://twitter.com/${handle.replace('@', '')}`;
        break;
      case 'tiktok':
        url = `https://tiktok.com/@${handle.replace('@', '')}`;
        break;
      case 'youtube':
        url = handle.startsWith('http') ? handle : `https://youtube.com/${handle}`;
        break;
      case 'spotify':
        url = handle.startsWith('http') ? handle : `https://open.spotify.com/${handle}`;
        break;
      case 'soundcloud':
        url = handle.startsWith('http') ? handle : `https://soundcloud.com/${handle}`;
        break;
      case 'facebook':
        url = handle.startsWith('http') ? handle : `https://facebook.com/${handle}`;
        break;
      case 'website':
        url = handle.startsWith('http') ? handle : `https://${handle}`;
        break;
      default:
        return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  const getSocialIcon = (platform: keyof SocialLinks): string => {
    switch (platform) {
      case 'instagram': return '📸';
      case 'twitter': return '🐦';
      case 'tiktok': return '🎵';
      case 'youtube': return '🎥';
      case 'spotify': return '🎶';
      case 'soundcloud': return '🔊';
      case 'facebook': return '👥';
      case 'website': return '🌐';
      default: return '🔗';
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 20,
      marginVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    avatarContainer: {
      marginRight: 20,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
    },
    artistName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    userRole: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    verifiedBadge: {
      marginLeft: 8,
      fontSize: 16,
    },
    editButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      alignSelf: 'flex-start',
    },
    editButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    bio: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 22,
      marginBottom: 15,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    infoIcon: {
      fontSize: 16,
      marginRight: 10,
      width: 20,
      textAlign: 'center',
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    socialLinks: {
      marginTop: 15,
    },
    socialLinksTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 10,
    },
    socialLinksGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 5,
    },
    socialLink: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      marginRight: 8,
      marginBottom: 8,
    },
    socialIcon: {
      marginRight: 6,
      fontSize: 14,
    },
    socialHandle: {
      fontSize: 12,
      color: theme.colors.text,
      fontWeight: '500',
    },
    genres: {
      marginTop: 15,
    },
    genresTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 10,
    },
    genresContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    genreTag: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      marginRight: 8,
      marginBottom: 8,
    },
    genreText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '500',
    },
    memberSince: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 15,
      textAlign: 'center',
    },
  });

  const formatMemberSince = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Avatar
            uri={profile.avatar}
            name={profile.name}
            size="xlarge"
            editable={!!onAvatarPress}
            onPress={onAvatarPress}
          />
        </View>
        
        <View style={styles.userInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.userName}>{profile.name}</Text>
            {profile.verified && (
              <Text style={styles.verifiedBadge}>✅</Text>
            )}
          </View>
          
          {profile.artistName && (
            <Text style={styles.artistName}>{profile.artistName}</Text>
          )}
          
          <Text style={styles.userRole}>{profile.role.toLowerCase()}</Text>
          
          {showEditButton && onEditPress && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={onEditPress}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {profile.bio && (
        <Text style={styles.bio}>{profile.bio}</Text>
      )}

      {profile.location && (
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📍</Text>
          <Text style={styles.infoText}>{profile.location}</Text>
        </View>
      )}

      {profile.website && (
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => handleSocialLinkPress('website', profile.website)}
        >
          <Text style={styles.infoIcon}>🌐</Text>
          <Text style={[styles.infoText, { color: theme.colors.primary }]}>
            {profile.website}
          </Text>
        </TouchableOpacity>
      )}

      {profile.genres && profile.genres.length > 0 && (
        <View style={styles.genres}>
          <Text style={styles.genresTitle}>Genres</Text>
          <View style={styles.genresContainer}>
            {profile.genres.map((genre, index) => (
              <View key={index} style={styles.genreTag}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {profile.socialLinks && Object.keys(profile.socialLinks).length > 0 && (
        <View style={styles.socialLinks}>
          <Text style={styles.socialLinksTitle}>Connect</Text>
          <View style={styles.socialLinksGrid}>
            {Object.entries(profile.socialLinks).map(([platform, handle]) => {
              if (!handle) return null;
              return (
                <TouchableOpacity
                  key={platform}
                  style={styles.socialLink}
                  onPress={() => handleSocialLinkPress(platform as keyof SocialLinks, handle)}
                >
                  <Text style={styles.socialIcon}>
                    {getSocialIcon(platform as keyof SocialLinks)}
                  </Text>
                  <Text style={styles.socialHandle}>{handle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <Text style={styles.memberSince}>
        Member since {formatMemberSince(profile.createdAt)}
      </Text>
    </View>
  );
};

export default ProfileInfoCard;