import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/lib/theme';
import type { JournalPeriodOption } from '@/utils/journal-periods';

interface JournalPeriodScrollerProps {
  title: string;
  options: JournalPeriodOption[];
  selectedKey: string;
  onSelect: (option: JournalPeriodOption) => void;
  onTodayPress?: () => void;
}

const ITEM_WIDTH = 80;
const ITEM_GAP = spacing.sm;

export function JournalPeriodScroller({
  title,
  options,
  selectedKey,
  onSelect,
  onTodayPress,
}: JournalPeriodScrollerProps) {
  const listRef = useRef<FlatList<JournalPeriodOption>>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const { width } = useWindowDimensions();

  const viewportWidth = frameWidth > 0 ? frameWidth : Math.max(0, width - spacing.lg * 2);
  const horizontalInset = Math.max(0, viewportWidth / 2 - ITEM_WIDTH / 2);
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.key === selectedKey),
    [options, selectedKey]
  );

  const scrollToSelected = useCallback(
    (animated: boolean) => {
      if (!listRef.current || selectedIndex < 0) return;
      listRef.current.scrollToIndex({
        index: selectedIndex,
        animated,
        viewPosition: 0.5,
      });
    },
    [selectedIndex]
  );

  useEffect(() => {
    scrollToSelected(true);
  }, [scrollToSelected, selectedKey, options, horizontalInset]);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {onTodayPress ? (
          <Pressable style={styles.todayButton} onPress={onTodayPress} testID="journal-period-today">
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
        ) : null}
      </View>
      <View
        style={styles.listFrame}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth !== frameWidth) {
            setFrameWidth(nextWidth);
          }
        }}
      >
        <FlatList
          ref={listRef}
          data={options}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          extraData={selectedKey}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalInset }]}
          testID="journal-period-scroller"
          getItemLayout={(_, index) => ({
            length: ITEM_WIDTH + ITEM_GAP,
            offset: (ITEM_WIDTH + ITEM_GAP) * index,
            index,
          })}
          onScrollToIndexFailed={({ index }) => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, index * (ITEM_WIDTH + ITEM_GAP)),
              animated: false,
            });
            requestAnimationFrame(() => scrollToSelected(true));
          }}
          renderItem={({ item: option }) => {
            const isSelected = option.key === selectedKey;
            return (
              <Pressable
                key={option.key}
                testID={`journal-period-${option.key}`}
                style={[
                  styles.option,
                  isSelected ? styles.optionSelected : null,
                ]}
                onPress={() => onSelect(option)}
              >
                <Text style={[styles.optionPrimary, isSelected ? styles.optionPrimarySelected : null]}>
                  {option.primaryLabel}
                </Text>
                {option.secondaryLabel ? (
                  <Text
                    style={[styles.optionSecondary, isSelected ? styles.optionSecondarySelected : null]}
                  >
                    {option.secondaryLabel}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  title: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  todayButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  todayButtonText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  listFrame: {
    width: '100%',
  },
  scrollContent: {
    paddingVertical: 1,
  },
  option: {
    width: ITEM_WIDTH,
    marginRight: ITEM_GAP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionPrimary: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  optionPrimarySelected: {
    color: colors.primary,
  },
  optionSecondary: {
    marginTop: 1,
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  optionSecondarySelected: {
    color: colors.primary,
  },
});
