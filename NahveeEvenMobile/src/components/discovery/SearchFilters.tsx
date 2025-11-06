import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Modal,
} from 'react-native';
import Slider from 'react-native-slider';
import { useTheme } from '../../hooks/useTheme';
import { 
  SearchFilters as SearchFiltersType, 
  ContentType, 
  ContentCategory, 
  SortOption,
  POPULAR_GENRES,
} from '../../types/discovery';

interface SearchFiltersProps {
  visible: boolean;
  filters: SearchFiltersType;
  categories: ContentCategory[];
  onFiltersChange: (filters: Partial<SearchFiltersType>) => void;
  onApply: () => void;
  onClose: () => void;
  onClear: () => void;
}

const SearchFilters: React.FC<SearchFiltersProps> = memo(({
  visible,
  filters,
  categories,
  onFiltersChange,
  onApply,
  onClose,
  onClear,
}) => {
  const { theme } = useTheme();
  const [localFilters, setLocalFilters] = useState<SearchFiltersType>(filters);

  const styles = StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.large,
      borderTopRightRadius: theme.borderRadius.large,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 18,
      color: theme.colors.text,
    },
    content: {
      flex: 1,
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      fontStyle: 'italic',
    },
    
    // Filter Options
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    option: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
    },
    optionActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    optionText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    optionTextActive: {
      color: 'white',
    },
    
    // Range Inputs
    rangeContainer: {
      marginBottom: 16,
    },
    rangeInputs: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rangeInput: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.colors.text,
    },
    rangeSeparator: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    
    // Slider
    sliderContainer: {
      marginVertical: 8,
    },
    sliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    sliderLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    sliderValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    
    // Switch Row
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    switchLabel: {
      fontSize: 16,
      color: theme.colors.text,
      flex: 1,
    },
    switchDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    
    // Sort Options
    sortContainer: {
      gap: 8,
    },
    sortOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    radioButtonInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'white',
    },
    sortLabel: {
      fontSize: 16,
      color: theme.colors.text,
      flex: 1,
    },
    
    // Footer
    footer: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    footerButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
    },
    clearButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    applyButton: {
      backgroundColor: theme.colors.primary,
    },
    footerButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    clearButtonText: {
      color: theme.colors.text,
    },
    applyButtonText: {
      color: 'white',
    },
    
    // Active Filters Summary
    activeFiltersContainer: {
      backgroundColor: theme.colors.primary + '10',
      padding: 12,
      margin: 16,
      borderRadius: theme.borderRadius.medium,
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
    },
    activeFiltersTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    activeFiltersText: {
      fontSize: 12,
      color: theme.colors.text,
    },
  });

  const updateFilters = useCallback((updates: Partial<SearchFiltersType>) => {
    const newFilters = { ...localFilters, ...updates };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  }, [localFilters, onFiltersChange]);

  const handleContentTypeToggle = useCallback((type: ContentType) => {
    const current = localFilters.contentTypes || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    updateFilters({ contentTypes: updated });
  }, [localFilters.contentTypes, updateFilters]);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    const current = localFilters.categories || [];
    const updated = current.includes(categoryId)
      ? current.filter(c => c !== categoryId)
      : [...current, categoryId];
    updateFilters({ categories: updated });
  }, [localFilters.categories, updateFilters]);

  const handleGenreToggle = useCallback((genre: string) => {
    const current = localFilters.genres || [];
    const updated = current.includes(genre)
      ? current.filter(g => g !== genre)
      : [...current, genre];
    updateFilters({ genres: updated });
  }, [localFilters.genres, updateFilters]);

  const handlePriceRangeChange = useCallback((field: 'min' | 'max', value: string) => {
    const numValue = parseFloat(value) || 0;
    const currentRange = localFilters.priceRange || { min: 0, max: 1000, includeFree: true };
    
    updateFilters({
      priceRange: {
        ...currentRange,
        [field]: numValue,
      }
    });
  }, [localFilters.priceRange, updateFilters]);

  const handleDurationRangeChange = useCallback((field: 'min' | 'max', value: string) => {
    const numValue = (parseFloat(value) || 0) * 60; // Convert minutes to seconds
    const currentRange = localFilters.duration || { min: 0, max: 3600 };
    
    updateFilters({
      duration: {
        ...currentRange,
        [field]: numValue,
      }
    });
  }, [localFilters.duration, updateFilters]);

  const handleRatingChange = useCallback((value: number) => {
    updateFilters({
      rating: { min: value }
    });
  }, [updateFilters]);

  const handleSortChange = useCallback((sortBy: SortOption) => {
    updateFilters({ sortBy });
  }, [updateFilters]);

  const getActiveFiltersCount = useCallback(() => {
    let count = 0;
    
    if (localFilters.contentTypes?.length) count += localFilters.contentTypes.length;
    if (localFilters.categories?.length) count += localFilters.categories.length;
    if (localFilters.genres?.length) count += localFilters.genres.length;
    if (localFilters.priceRange?.min !== 0 || localFilters.priceRange?.max !== 1000) count += 1;
    if (localFilters.duration?.min !== 0 || localFilters.duration?.max !== 3600) count += 1;
    if (localFilters.rating?.min !== 0) count += 1;
    if (localFilters.verifiedOnly) count += 1;
    
    return count;
  }, [localFilters]);

  const getActiveFiltersDescription = useCallback(() => {
    const descriptions: string[] = [];
    
    if (localFilters.contentTypes?.length) {
      descriptions.push(`${localFilters.contentTypes.length} content type${localFilters.contentTypes.length > 1 ? 's' : ''}`);
    }
    if (localFilters.categories?.length) {
      descriptions.push(`${localFilters.categories.length} categor${localFilters.categories.length > 1 ? 'ies' : 'y'}`);
    }
    if (localFilters.genres?.length) {
      descriptions.push(`${localFilters.genres.length} genre${localFilters.genres.length > 1 ? 's' : ''}`);
    }
    if (localFilters.priceRange?.min !== 0 || localFilters.priceRange?.max !== 1000) {
      descriptions.push('Price range');
    }
    if (localFilters.duration?.min !== 0 || localFilters.duration?.max !== 3600) {
      descriptions.push('Duration range');
    }
    if (localFilters.rating?.min !== 0) {
      descriptions.push(`${localFilters.rating.min}+ stars`);
    }
    if (localFilters.verifiedOnly) {
      descriptions.push('Verified only');
    }
    
    return descriptions.join(', ');
  }, [localFilters]);

  const contentTypes: Array<{ type: ContentType; label: string; icon: string }> = [
    { type: 'AUDIO', label: 'Music', icon: '🎵' },
    { type: 'VIDEO', label: 'Video', icon: '🎬' },
    { type: 'IMAGE', label: 'Photo', icon: '📷' },
    { type: 'TEXT', label: 'Text', icon: '📝' },
    { type: 'LIVE', label: 'Live', icon: '🔴' },
  ];

  const sortOptions: Array<{ value: SortOption; label: string; description: string }> = [
    { value: 'relevance', label: 'Relevance', description: 'Most relevant to your search' },
    { value: 'newest', label: 'Newest', description: 'Recently uploaded content' },
    { value: 'oldest', label: 'Oldest', description: 'Oldest content first' },
    { value: 'popular', label: 'Most Popular', description: 'Based on views and engagement' },
    { value: 'trending', label: 'Trending', description: 'Currently trending content' },
    { value: 'rating', label: 'Highest Rated', description: 'Best rated content' },
    { value: 'price_low', label: 'Price: Low to High', description: 'Cheapest content first' },
    { value: 'price_high', label: 'Price: High to Low', description: 'Most expensive first' },
  ];

  if (!visible) return null;

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Search Filters</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Active Filters Summary */}
          {activeFiltersCount > 0 && (
            <View style={styles.activeFiltersContainer}>
              <Text style={styles.activeFiltersTitle}>
                {activeFiltersCount} Filter{activeFiltersCount > 1 ? 's' : ''} Active
              </Text>
              <Text style={styles.activeFiltersText}>
                {getActiveFiltersDescription()}
              </Text>
            </View>
          )}

          <ScrollView style={styles.content}>
            {/* Content Types */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Content Types</Text>
              <Text style={styles.sectionSubtitle}>Filter by the type of content you're looking for</Text>
              <View style={styles.optionsGrid}>
                {contentTypes.map(({ type, label, icon }) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.option,
                      localFilters.contentTypes?.includes(type) && styles.optionActive,
                    ]}
                    onPress={() => handleContentTypeToggle(type)}
                  >
                    <Text style={[
                      styles.optionText,
                      localFilters.contentTypes?.includes(type) && styles.optionTextActive,
                    ]}>
                      {icon} {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Categories */}
            {categories.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Categories</Text>
                <Text style={styles.sectionSubtitle}>Browse content by category</Text>
                <View style={styles.optionsGrid}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.option,
                        localFilters.categories?.includes(category.id) && styles.optionActive,
                      ]}
                      onPress={() => handleCategoryToggle(category.id)}
                    >
                      <Text style={[
                        styles.optionText,
                        localFilters.categories?.includes(category.id) && styles.optionTextActive,
                      ]}>
                        {category.icon} {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Genres */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <Text style={styles.sectionSubtitle}>Find content by musical or content genre</Text>
              <View style={styles.optionsGrid}>
                {POPULAR_GENRES.map((genre) => (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.option,
                      localFilters.genres?.includes(genre) && styles.optionActive,
                    ]}
                    onPress={() => handleGenreToggle(genre)}
                  >
                    <Text style={[
                      styles.optionText,
                      localFilters.genres?.includes(genre) && styles.optionTextActive,
                    ]}>
                      {genre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price Range */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price Range</Text>
              <Text style={styles.sectionSubtitle}>Set minimum and maximum price in USD</Text>
              <View style={styles.rangeContainer}>
                <View style={styles.rangeInputs}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min ($)"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={localFilters.priceRange?.min?.toString() || ''}
                    onChangeText={(text) => handlePriceRangeChange('min', text)}
                    keyboardType="numeric"
                  />
                  <Text style={styles.rangeSeparator}>to</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max ($)"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={localFilters.priceRange?.max?.toString() || ''}
                    onChangeText={(text) => handlePriceRangeChange('max', text)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* Duration Range */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Duration</Text>
              <Text style={styles.sectionSubtitle}>Filter content by length in minutes</Text>
              <View style={styles.rangeContainer}>
                <View style={styles.rangeInputs}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (min)"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={localFilters.duration?.min ? Math.floor(localFilters.duration.min / 60).toString() : ''}
                    onChangeText={(text) => handleDurationRangeChange('min', text)}
                    keyboardType="numeric"
                  />
                  <Text style={styles.rangeSeparator}>to</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max (min)"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={localFilters.duration?.max ? Math.floor(localFilters.duration.max / 60).toString() : ''}
                    onChangeText={(text) => handleDurationRangeChange('max', text)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Minimum Rating</Text>
              <Text style={styles.sectionSubtitle}>Show content with at least this rating</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderValue}>
                  {localFilters.rating?.min === 0 ? 'Any Rating' : `${localFilters.rating?.min}+ Stars`}
                </Text>
                <Slider
                  style={{ height: 40 }}
                  minimumValue={0}
                  maximumValue={5}
                  step={0.5}
                  value={localFilters.rating?.min || 0}
                  onValueChange={handleRatingChange}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.border}
                  thumbStyle={{ backgroundColor: theme.colors.primary }}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>Any</Text>
                  <Text style={styles.sliderLabel}>5⭐</Text>
                </View>
              </View>
            </View>

            {/* Other Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Other Options</Text>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Verified Creators Only</Text>
                  <Text style={styles.switchDescription}>Show content from verified creators only</Text>
                </View>
                <Switch
                  value={localFilters.verifiedOnly || false}
                  onValueChange={(value) => updateFilters({ verifiedOnly: value })}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.primary + '80',
                  }}
                  thumbColor={localFilters.verifiedOnly ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>
            </View>

            {/* Sort Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sort Results</Text>
              <Text style={styles.sectionSubtitle}>Choose how to order search results</Text>
              <View style={styles.sortContainer}>
                {sortOptions.map(({ value, label, description }) => (
                  <TouchableOpacity
                    key={value}
                    style={styles.sortOption}
                    onPress={() => handleSortChange(value)}
                  >
                    <View style={[
                      styles.radioButton,
                      localFilters.sortBy === value && styles.radioButtonActive,
                    ]}>
                      {localFilters.sortBy === value && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sortLabel}>{label}</Text>
                      <Text style={styles.switchDescription}>{description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerButton, styles.clearButton]}
              onPress={onClear}
            >
              <Text style={[styles.footerButtonText, styles.clearButtonText]}>
                Clear All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, styles.applyButton]}
              onPress={onApply}
            >
              <Text style={[styles.footerButtonText, styles.applyButtonText]}>
                Apply Filters ({activeFiltersCount})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

SearchFilters.displayName = 'SearchFilters';

export default SearchFilters;