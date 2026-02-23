import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  Modal,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useUpload } from '../../contexts/UploadContext';
import {
  ContentMetadata,
  ContentCategory,
  ContentVisibility,
  PricingType,
  ValidationResult,
  UPLOAD_CONSTANTS,
} from '../../types/upload';

interface ContentMetadataFormProps {
  onNext?: () => void;
  onBack?: () => void;
  showNavigation?: boolean;
}

const ContentMetadataForm: React.FC<ContentMetadataFormProps> = ({
  onNext,
  onBack,
  showNavigation = true,
}) => {
  const { theme } = useTheme();
  const { state, updateMetadata, validateCurrentUpload, saveDraft } = useUpload();

  const [localMetadata, setLocalMetadata] = useState<Partial<ContentMetadata>>(state.currentUpload.metadata);
  const [tagInput, setTagInput] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 6,
    },
    requiredLabel: {
      color: theme.colors.error,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
      minHeight: 48,
    },
    inputFocused: {
      borderColor: theme.colors.primary,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    picker: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 48,
    },
    pickerText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    pickerPlaceholder: {
      color: theme.colors.textSecondary,
    },
    pickerArrow: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    tagsContainer: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      padding: 12,
      minHeight: 48,
    },
    tagsInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    tagInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      padding: 0,
    },
    addTagButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.small,
      marginLeft: 8,
    },
    addTagButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    tagsWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      backgroundColor: theme.colors.primary + '20',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.small,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },
    tagText: {
      fontSize: 14,
      color: theme.colors.primary,
      marginRight: 6,
    },
    tagRemove: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    switchLabel: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    switchDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    priceInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    currencySymbol: {
      position: 'absolute',
      left: 16,
      fontSize: 16,
      color: theme.colors.textSecondary,
      zIndex: 1,
    },
    priceInput: {
      paddingLeft: 32,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      marginTop: 4,
    },
    warningText: {
      fontSize: 12,
      color: theme.colors.warning,
      marginTop: 4,
    },
    navigation: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 12,
    },
    navButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
      borderWidth: 1,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    navButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryButtonText: {
      color: 'white',
    },
    secondaryButtonText: {
      color: theme.colors.text,
    },
    disabledButton: {
      opacity: 0.5,
    },

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.large,
      borderTopRightRadius: theme.borderRadius.large,
      maxHeight: '60%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    modalCloseButton: {
      padding: 8,
    },
    modalCloseText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    optionsList: {
      paddingVertical: 8,
    },
    optionItem: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    optionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    optionDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    selectedOption: {
      backgroundColor: theme.colors.primary + '10',
    },
  });

  // Keep local state in sync with context
  useEffect(() => {
    setLocalMetadata(state.currentUpload.metadata);
  }, [state.currentUpload.metadata]);

  // Auto-save changes
  useEffect(() => {
    if (hasChanges) {
      const timeoutId = setTimeout(() => {
        updateMetadata(localMetadata);
        setHasChanges(false);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [localMetadata, hasChanges, updateMetadata]);

  const updateLocalMetadata = useCallback((updates: Partial<ContentMetadata>) => {
    setLocalMetadata(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !(localMetadata.tags || []).includes(tag)) {
      updateLocalMetadata({
        tags: [...(localMetadata.tags || []), tag],
      });
      setTagInput('');
    }
  }, [tagInput, localMetadata.tags, updateLocalMetadata]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    updateLocalMetadata({
      tags: (localMetadata.tags || []).filter(tag => tag !== tagToRemove),
    });
  }, [localMetadata.tags, updateLocalMetadata]);

  const handleNext = useCallback(() => {
    // Validate before proceeding
    updateMetadata(localMetadata);
    const validationResult = validateCurrentUpload();
    setValidation(validationResult);
    
    if (validationResult.isValid) {
      onNext?.();
    } else {
      Alert.alert(
        'Incomplete Information',
        'Please fill in all required fields before continuing.',
        [{ text: 'OK' }]
      );
    }
  }, [localMetadata, updateMetadata, validateCurrentUpload, onNext]);

  const getFieldError = useCallback((fieldName: string) => {
    return validation?.errors.find(error => error.field === fieldName);
  }, [validation]);

  const getFieldWarning = useCallback((fieldName: string) => {
    return validation?.warnings.find(warning => warning.field === fieldName);
  }, [validation]);

  const categories: Array<{ key: ContentCategory; label: string; description: string }> = [
    { key: 'music', label: 'Music', description: 'Songs, albums, singles' },
    { key: 'podcast', label: 'Podcast', description: 'Episodic audio content' },
    { key: 'audiobook', label: 'Audiobook', description: 'Narrated books and stories' },
    { key: 'sound_effect', label: 'Sound Effect', description: 'Audio clips and samples' },
    { key: 'video', label: 'Video', description: 'Films, tutorials, vlogs' },
    { key: 'art', label: 'Digital Art', description: 'Illustrations, designs, graphics' },
    { key: 'photography', label: 'Photography', description: 'Photos and visual content' },
    { key: 'document', label: 'Document', description: 'PDFs, texts, ebooks' },
    { key: 'other', label: 'Other', description: 'Miscellaneous content' },
  ];

  const visibilityOptions: Array<{ key: ContentVisibility; label: string; description: string }> = [
    { key: 'public', label: 'Public', description: 'Anyone can discover and access' },
    { key: 'unlisted', label: 'Unlisted', description: 'Only accessible with direct link' },
    { key: 'subscribers_only', label: 'Subscribers Only', description: 'Only your subscribers can access' },
    { key: 'private', label: 'Private', description: 'Only you can access' },
  ];

  const renderCategoryPicker = () => (
    <Modal
      visible={showCategoryPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCategoryPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCategoryPicker(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.optionsList}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.optionItem,
                  localMetadata.category === category.key && styles.selectedOption,
                ]}
                onPress={() => {
                  updateLocalMetadata({ category: category.key });
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={styles.optionText}>{category.label}</Text>
                <Text style={styles.optionDescription}>{category.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );

  const renderVisibilityPicker = () => (
    <Modal
      visible={showVisibilityPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowVisibilityPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Visibility</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowVisibilityPicker(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.optionsList}>
            {visibilityOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionItem,
                  localMetadata.visibility === option.key && styles.selectedOption,
                ]}
                onPress={() => {
                  updateLocalMetadata({ visibility: option.key });
                  setShowVisibilityPicker(false);
                }}
              >
                <Text style={styles.optionText}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );

  const titleError = getFieldError('title');
  const descriptionWarning = getFieldWarning('description');
  const priceError = getFieldError('price');
  const tagsWarning = getFieldWarning('tags');

  const selectedCategory = categories.find(cat => cat.key === localMetadata.category);
  const selectedVisibility = visibilityOptions.find(opt => opt.key === localMetadata.visibility);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, titleError && styles.requiredLabel]}>
              Title *
            </Text>
            <TextInput
              style={[
                styles.input,
                titleError && styles.inputError,
              ]}
              value={localMetadata.title || ''}
              onChangeText={(text) => updateLocalMetadata({ title: text })}
              placeholder="Enter a descriptive title"
              placeholderTextColor={theme.colors.textSecondary}
              maxLength={100}
            />
            {titleError && <Text style={styles.errorText}>{titleError.message}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={localMetadata.description || ''}
              onChangeText={(text) => updateLocalMetadata({ description: text })}
              placeholder="Describe your content..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
            {descriptionWarning && <Text style={styles.warningText}>{descriptionWarning.message}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Text style={selectedCategory ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedCategory?.label || 'Select category'}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tags</Text>
            <View style={styles.tagsContainer}>
              <View style={styles.tagsInputContainer}>
                <TextInput
                  style={styles.tagInput}
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="Add tags to help people find your content"
                  placeholderTextColor={theme.colors.textSecondary}
                  onSubmitEditing={handleAddTag}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.addTagButton}
                  onPress={handleAddTag}
                  disabled={!tagInput.trim()}
                >
                  <Text style={styles.addTagButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              
              {(localMetadata.tags?.length || 0) > 0 && (
                <View style={styles.tagsWrapper}>
                  {localMetadata.tags?.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                      <TouchableOpacity onPress={() => handleRemoveTag(tag)}>
                        <Text style={styles.tagRemove}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
            {tagsWarning && <Text style={styles.warningText}>{tagsWarning.message}</Text>}
          </View>
        </View>

        {/* Visibility & Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visibility & Pricing</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Visibility</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowVisibilityPicker(true)}
            >
              <Text style={selectedVisibility ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedVisibility?.label || 'Select visibility'}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pricing</Text>
            
            {/* Pricing Type Selection */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Free Content</Text>
                <Text style={styles.switchDescription}>Anyone can access for free</Text>
              </View>
              <Switch
                value={localMetadata.pricingType === 'free'}
                onValueChange={(value) => 
                  updateLocalMetadata({ 
                    pricingType: value ? 'free' : 'paid',
                    price: value ? undefined : 0,
                  })
                }
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.background}
              />
            </View>

            {localMetadata.pricingType === 'paid' && (
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={[styles.input, styles.priceInput, priceError && styles.inputError]}
                  value={localMetadata.price?.toString() || ''}
                  onChangeText={(text) => {
                    const price = parseFloat(text) || 0;
                    updateLocalMetadata({ price });
                  }}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
            )}
            {priceError && <Text style={styles.errorText}>{priceError.message}</Text>}
          </View>
        </View>

        {/* Content Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Settings</Text>
          
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Explicit Content</Text>
              <Text style={styles.switchDescription}>Contains mature themes or language</Text>
            </View>
            <Switch
              value={localMetadata.isExplicit || false}
              onValueChange={(value) => updateLocalMetadata({ isExplicit: value })}
              trackColor={{ false: theme.colors.border, true: theme.colors.error }}
              thumbColor={theme.colors.background}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Allow Comments</Text>
              <Text style={styles.switchDescription}>Users can leave comments</Text>
            </View>
            <Switch
              value={localMetadata.allowComments !== false}
              onValueChange={(value) => updateLocalMetadata({ allowComments: value })}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Allow Downloads</Text>
              <Text style={styles.switchDescription}>Users can download your content</Text>
            </View>
            <Switch
              value={localMetadata.allowDownloads !== false}
              onValueChange={(value) => updateLocalMetadata({ allowDownloads: value })}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>
        </View>
      </ScrollView>

      {showNavigation && (
        <View style={styles.navigation}>
          {onBack && (
            <TouchableOpacity
              style={[styles.navButton, styles.secondaryButton]}
              onPress={onBack}
            >
              <Text style={[styles.navButtonText, styles.secondaryButtonText]}>
                Back
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.navButton, styles.primaryButton]}
            onPress={handleNext}
          >
            <Text style={[styles.navButtonText, styles.primaryButtonText]}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {renderCategoryPicker()}
      {renderVisibilityPicker()}
    </View>
  );
};

export default ContentMetadataForm;