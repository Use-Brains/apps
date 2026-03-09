import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
} from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function TagInput({ tags, onChange, suggestions = [], placeholder = 'Add tag...' }: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !tags.includes(s) &&
      input.length > 0
  );

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
      setInput('');
      setShowSuggestions(false);
    },
    [tags, onChange]
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange]
  );

  return (
    <View>
      <View style={styles.tagsRow}>
        {tags.map((tag, i) => (
          <Pressable key={tag} style={styles.tag} onPress={() => removeTag(i)}>
            <Text style={styles.tagText}>{tag} ×</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={(text) => {
          setInput(text);
          setShowSuggestions(true);
        }}
        onSubmitEditing={() => addTag(input)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="done"
        autoCapitalize="none"
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <View style={styles.suggestions}>
          {filteredSuggestions.slice(0, 5).map((suggestion) => (
            <Pressable
              key={suggestion}
              style={styles.suggestion}
              onPress={() => addTag(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  suggestions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  suggestion: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
});
