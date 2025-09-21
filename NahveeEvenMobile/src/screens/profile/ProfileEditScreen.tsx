import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfile } from '../../contexts/ProfileContext';
import { ProfileStackParamList } from '../../types/navigation';
import { ProfileEditData } from '../../types/profile';
import Avatar from '../../components/profile/Avatar';

type ProfileEditNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;

const ProfileEditScreen: React.FC = () => {
  const { theme } = useTheme();
  const { profile, updateProfile, isLoading, validationErrors, clearErrors } = useProfile();
  const navigation = useNavigation<ProfileEditNavigationProp>();

  const [formData, setFormData] = useState<ProfileEditData>({
    name: '',
    bio: '',
    location: '',
    website: '',
    artistName: '',
    genres: [],
    socialLinks: {},
  });

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [customGenre, setCustomGenre] = useState('');

  const POPULAR_GENRES = [
    'R&B', 'Hip-Hop', 'Pop', 'Soul', 'Jazz', 'Rock', 
    'Electronic', 'Country', 'Gospel', 'Reggae', 'Blues'
  ];

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        website: profile.website || '',
        artistName: profile.artistName || '',
        socialLinks: {
          instagram: profile.socialLinks?.instagram || '',
          twitter: profile.socialLinks?.twitter || '',
          tiktok: profile.socialLinks?.tiktok || '',
          youtube: profile.socialLinks?.youtube || '',
          spotify: profile.socialLinks?.spotify || '',
          soundcloud: profile.socialLinks?.soundcloud || '',
        },
      });
      setSelectedGenres(profile.genres || []);
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      clearErrors();
      const dataToSave = {
        ...formData,
        genres: selectedGenres,
      };
      await updateProfile(dataToSave);
      
      if (!validationErrors) {
        Alert.alert('Success', 'Profile updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const addCustomGenre = () => {
    if (customGenre.trim() && !selectedGenres.includes(customGenre.trim())) {
      setSelectedGenres(prev => [...prev, customGenre.trim()]);
      setCustomGenre('');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    headerButtonText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },
    section: {
      marginVertical: 15,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 15,
    },
    avatarSection: {
      alignItems: 'center',
      marginVertical: 20,
    },
    avatarButton: {
      marginTop: 10,
    },
    avatarButtonText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '500',
    },
    inputGroup: {
      marginBottom: 15,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 12,
      marginTop: 5,
    },
    genresContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
    },
    genreTag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginRight: 8,
      marginBottom: 8,
      borderWidth: 1,
    },
    genreTagSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    genreTagUnselected: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    genreTagText: {
      fontSize: 12,
      fontWeight: '500',
    },
    genreTagTextSelected: {
      color: 'white',
    },
    genreTagTextUnselected: {
      color: theme.colors.text,
    },
    customGenreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
    },
    customGenreInput: {
      flex: 1,
      marginRight: 10,
    },
    addGenreButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 6,
    },
    addGenreButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    socialInputsContainer: {
      gap: 15,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Edit Profile</Text>
        
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={[
            styles.headerButtonText,
            { opacity: isLoading ? 0.5 : 1 }
          ]}>
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Avatar
            uri={profile?.avatar}
            name={formData.name || profile?.name}
            size="xlarge"
            editable
          />
          <TouchableOpacity style={styles.avatarButton}>
            <Text style={styles.avatarButtonText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Your display name"
              placeholderTextColor={theme.colors.textSecondary}
            />
            {validationErrors?.name && (
              <Text style={styles.errorText}>{validationErrors.name}</Text>
            )}
          </View>

          {profile?.role === 'ARTIST' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Artist Name</Text>
              <TextInput
                style={styles.input}
                value={formData.artistName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, artistName: text }))}
                placeholder="Your artist/stage name"
                placeholderTextColor={theme.colors.textSecondary}
              />
              {validationErrors?.artistName && (
                <Text style={styles.errorText}>{validationErrors.artistName}</Text>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.bio}
              onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
              placeholder="Tell people about yourself..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={500}
            />
            <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
              {formData.bio?.length || 0}/500
            </Text>
            {validationErrors?.bio && (
              <Text style={styles.errorText}>{validationErrors.bio}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
              placeholder="City, State/Country"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              value={formData.website}
              onChangeText={(text) => setFormData(prev => ({ ...prev, website: text }))}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
            {validationErrors?.website && (
              <Text style={styles.errorText}>{validationErrors.website}</Text>
            )}
          </View>
        </View>

        {/* Genres (for artists) */}
        {profile?.role === 'ARTIST' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Genres</Text>
            <View style={styles.genresContainer}>
              {POPULAR_GENRES.map((genre) => (
                <TouchableOpacity
                  key={genre}
                  style={[
                    styles.genreTag,
                    selectedGenres.includes(genre)
                      ? styles.genreTagSelected
                      : styles.genreTagUnselected,
                  ]}
                  onPress={() => toggleGenre(genre)}
                >
                  <Text
                    style={[
                      styles.genreTagText,
                      selectedGenres.includes(genre)
                        ? styles.genreTagTextSelected
                        : styles.genreTagTextUnselected,
                    ]}
                  >
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.customGenreContainer}>
              <TextInput
                style={[styles.input, styles.customGenreInput]}
                value={customGenre}
                onChangeText={setCustomGenre}
                placeholder="Add custom genre..."
                placeholderTextColor={theme.colors.textSecondary}
              />
              <TouchableOpacity
                style={styles.addGenreButton}
                onPress={addCustomGenre}
                disabled={!customGenre.trim()}
              >
                <Text style={styles.addGenreButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Social Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Links</Text>
          <View style={styles.socialInputsContainer}>
            {[
              { key: 'instagram', label: 'Instagram', placeholder: '@username' },
              { key: 'twitter', label: 'Twitter', placeholder: '@username' },
              { key: 'tiktok', label: 'TikTok', placeholder: '@username' },
              { key: 'youtube', label: 'YouTube', placeholder: 'Channel URL' },
              { key: 'spotify', label: 'Spotify', placeholder: 'Artist URL' },
              { key: 'soundcloud', label: 'SoundCloud', placeholder: 'Profile URL' },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={styles.inputGroup}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.socialLinks?.[key as keyof typeof formData.socialLinks] || ''}
                  onChangeText={(text) => setFormData(prev => ({
                    ...prev,
                    socialLinks: {
                      ...prev.socialLinks,
                      [key]: text,
                    },
                  }))}
                  placeholder={placeholder}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
                {validationErrors?.socialLinks?.[key as keyof typeof validationErrors.socialLinks] && (
                  <Text style={styles.errorText}>
                    {validationErrors.socialLinks[key as keyof typeof validationErrors.socialLinks]}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileEditScreen;