import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelected: (emoji: string) => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const { width: screenWidth } = Dimensions.get('window');
const emojiSize = (screenWidth - 60) / 8; // 8 emojis per row with padding

// Basic emoji categories
const emojiCategories: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
      '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
      '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳',
      '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
    ],
  },
  {
    id: 'people',
    name: 'People',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌',
      '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕',
      '👇', '☝', '👍', '👎', '👊', '✊', '🤛', '🤜',
      '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍', '💅',
      '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
      '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁',
    ],
  },
  {
    id: 'nature',
    name: 'Nature',
    icon: '🌱',
    emojis: [
      '🌱', '🌿', '🍀', '🍃', '🍂', '🍁', '🌾', '🌵',
      '🌴', '🌳', '🌲', '🌻', '🌺', '🌹', '🥀', '🌷',
      '🌸', '💐', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜',
      '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓',
      '🌔', '🌙', '⭐', '🌟', '💫', '✨', '☄', '☀',
      '🌤', '⛅', '🌦', '🌧', '⛈', '🌩', '🌨', '❄',
    ],
  },
  {
    id: 'food',
    name: 'Food',
    icon: '🍎',
    emojis: [
      '🍎', '🍏', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓',
      '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
      '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑',
      '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐',
      '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈',
      '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭',
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌', '🎿',
      '⛷', '🏂', '🪂', '🏋', '🤸', '🤺', '⛹', '🤾',
      '🏌', '🧘', '🏃', '🚶', '🧎', '🧑‍🦯', '🧑‍🦼', '🧑‍🦽',
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '📱',
    emojis: [
      '📱', '📲', '💻', '⌨', '🖥', '🖨', '🖱', '🖲',
      '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷',
      '📸', '📹', '🎥', '📽', '🎞', '📞', '☎', '📟',
      '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱',
      '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌',
      '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️',
      '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
      '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
      '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️',
    ],
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: '🏳️',
    emojis: [
      '🏁', '🚩', '🏳️', '🏴', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫',
      '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶',
      '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸',
      '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲',
      '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇧🇳', '🇧🇬', '🇧🇫',
      '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾',
    ],
  },
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onClose,
  onEmojiSelected,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [activeCategory, setActiveCategory] = useState('smileys');

  const handleEmojiPress = (emoji: string) => {
    onEmojiSelected(emoji);
  };

  const renderEmojiItem = ({ item: emoji }: { item: string }) => (
    <TouchableOpacity
      style={styles.emojiButton}
      onPress={() => handleEmojiPress(emoji)}
      activeOpacity={0.7}
    >
      <Text style={styles.emoji}>{emoji}</Text>
    </TouchableOpacity>
  );

  const renderCategoryButton = (category: EmojiCategory) => (
    <TouchableOpacity
      key={category.id}
      style={[
        styles.categoryButton,
        activeCategory === category.id && styles.activeCategoryButton,
      ]}
      onPress={() => setActiveCategory(category.id)}
      activeOpacity={0.7}
    >
      <Text style={styles.categoryIcon}>{category.icon}</Text>
    </TouchableOpacity>
  );

  const activeEmojis = emojiCategories.find(cat => cat.id === activeCategory)?.emojis || [];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choose Emoji</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Category tabs */}
          <View style={styles.categoriesContainer}>
            <FlatList
              horizontal
              data={emojiCategories}
              renderItem={({ item }) => renderCategoryButton(item)}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContent}
            />
          </View>

          {/* Emoji grid */}
          <FlatList
            data={activeEmojis}
            renderItem={renderEmojiItem}
            keyExtractor={(item, index) => `${activeCategory}-${index}`}
            numColumns={8}
            style={styles.emojiGrid}
            contentContainerStyle={styles.emojiContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Quick reactions */}
          <View style={styles.quickReactions}>
            <Text style={styles.quickReactionsTitle}>Quick Reactions</Text>
            <View style={styles.quickEmojis}>
              {['❤️', '😂', '😍', '👍', '😢', '😮', '😡', '🎵'].map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickEmojiButton}
                  onPress={() => handleEmojiPress(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area bottom
    maxHeight: '75%',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  
  // Categories
  categoriesContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  categoriesContent: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 20,
  },
  activeCategoryButton: {
    backgroundColor: colors.primary,
  },
  categoryIcon: {
    fontSize: 20,
  },
  
  // Emoji grid
  emojiGrid: {
    flex: 1,
  },
  emojiContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emojiButton: {
    width: emojiSize,
    height: emojiSize,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
  },
  emoji: {
    fontSize: 24,
  },
  
  // Quick reactions
  quickReactions: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  quickReactionsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  quickEmojis: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickEmojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 20,
  },
  quickEmoji: {
    fontSize: 20,
  },
});

export default EmojiPicker;