import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fontWeight } from '@/lib/theme';

interface FilterBarProps {
  onSearchChange: (text: string) => void;
  onSideFilter: (side: 'long' | 'short' | undefined) => void;
  onTagFilter: (tag: string | undefined) => void;
  activeSide?: 'long' | 'short';
  activeTag?: string;
  availableTags?: string[];
}

export function FilterBar({
  onSearchChange,
  onSideFilter,
  onTagFilter,
  activeSide,
  activeTag,
  availableTags = [],
}: FilterBarProps) {
  const [search, setSearch] = useState('');

  const handleSearch = (text: string) => {
    setSearch(text);
    onSearchChange(text);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={handleSearch}
        placeholder="Search by symbol..."
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="characters"
        clearButtonMode="while-editing"
      />
      <View style={styles.filters}>
        <Pressable
          style={[styles.chip, activeSide === 'long' && styles.chipActive]}
          onPress={() => onSideFilter(activeSide === 'long' ? undefined : 'long')}
        >
          <Text style={[styles.chipText, activeSide === 'long' && styles.chipActiveText]}>
            Long
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, activeSide === 'short' && styles.chipActive]}
          onPress={() => onSideFilter(activeSide === 'short' ? undefined : 'short')}
        >
          <Text style={[styles.chipText, activeSide === 'short' && styles.chipActiveText]}>
            Short
          </Text>
        </Pressable>
        {availableTags.slice(0, 5).map((tag) => (
          <Pressable
            key={tag}
            style={[styles.chip, activeTag === tag && styles.chipActive]}
            onPress={() => onTagFilter(activeTag === tag ? undefined : tag)}
          >
            <Text style={[styles.chipText, activeTag === tag && styles.chipActiveText]}>
              {tag}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  chipActiveText: {
    color: colors.textInverse,
  },
});
