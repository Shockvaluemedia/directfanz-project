import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { MESSAGE_LIMITS, MediaAttachment } from '../../types/messaging';
import MediaAttachmentPicker from './MediaAttachmentPicker';
import EmojiPicker from './EmojiPicker';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (message: string) => void;
  onMediaSelected?: (attachment: MediaAttachment) => void;
  onEmojiPress?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  multiline?: boolean;
  allowedMediaTypes?: Array<'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE'>;
  maxFileSize?: number;
}

const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChangeText,
  onSend,
  onMediaSelected,
  onEmojiPress,
  placeholder = "Type a message...",
  disabled = false,
  maxLength = MESSAGE_LIMITS.MAX_MESSAGE_LENGTH,
  multiline = true,
  allowedMediaTypes = ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'],
  maxFileSize = 50 * 1024 * 1024,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [inputHeight, setInputHeight] = useState(40);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmedMessage = value.trim();
    if (trimmedMessage && !disabled) {
      onSend(trimmedMessage);
      Keyboard.dismiss();
    }
  };

  const handleContentSizeChange = (event: any) => {
    const height = Math.min(Math.max(40, event.nativeEvent.contentSize.height), 100);
    setInputHeight(height);
  };

  const handleMediaPress = () => {
    setShowMediaPicker(true);
  };

  const handleMediaSelected = (attachment: MediaAttachment) => {
    onMediaSelected?.(attachment);
    setShowMediaPicker(false);
  };

  const handleCloseMediaPicker = () => {
    setShowMediaPicker(false);
  };

  const handleEmojiPress = () => {
    setShowEmojiPicker(true);
  };

  const handleEmojiSelected = (emoji: string) => {
    // Insert emoji at current cursor position or at the end
    const newText = value + emoji;
    onChangeText(newText);
    setShowEmojiPicker(false);
    
    // Focus back on input
    inputRef.current?.focus();
  };

  const handleCloseEmojiPicker = () => {
    setShowEmojiPicker(false);
  };

  const isNearLimit = value.length > maxLength * 0.8;
  const isAtLimit = value.length >= maxLength;
  const canSend = value.trim().length > 0 && !disabled && !isAtLimit;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        {/* Media attachment button */}
        {onMediaSelected && (
          <TouchableOpacity
            style={styles.mediaButton}
            onPress={handleMediaPress}
            disabled={disabled}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name="attach" 
              size={22} 
              color={disabled ? colors.textSecondary : colors.primary} 
            />
          </TouchableOpacity>
        )}

        {/* Text input */}
        <View style={[
          styles.textInputContainer,
          { height: inputHeight + 16 },
          isAtLimit && styles.textInputContainerError
        ]}>
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { height: inputHeight }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            multiline={multiline}
            textAlignVertical="top"
            maxLength={maxLength}
            editable={!disabled}
            onContentSizeChange={handleContentSizeChange}
            keyboardType="default"
            returnKeyType="default"
            blurOnSubmit={false}
          />
          
          {/* Character count */}
          {isNearLimit && (
            <View style={styles.charCount}>
              <Text style={[
                styles.charCountText,
                isAtLimit && styles.charCountTextError
              ]}>
                {value.length}/{maxLength}
              </Text>
            </View>
          )}
        </View>

        {/* Emoji button */}
        <TouchableOpacity
          style={styles.emojiButton}
          onPress={handleEmojiPress}
          disabled={disabled}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="happy-outline" 
            size={22} 
            color={disabled ? colors.textSecondary : colors.primary} 
          />
        </TouchableOpacity>

        {/* Send button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            canSend && styles.sendButtonActive
          ]}
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={canSend ? colors.onPrimary : colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Media Attachment Picker */}
      <MediaAttachmentPicker
        visible={showMediaPicker}
        onClose={handleCloseMediaPicker}
        onMediaSelected={handleMediaSelected}
        allowedTypes={allowedMediaTypes}
        maxFileSize={maxFileSize}
      />
      
      {/* Emoji Picker */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={handleCloseEmojiPicker}
        onEmojiSelected={handleEmojiSelected}
      />
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    maxHeight: 116, // 100 + 16 padding
    position: 'relative',
  },
  textInputContainerError: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  textInput: {
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  charCountText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  charCountTextError: {
    color: colors.error,
  },
  mediaButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
});

export default MessageInput;