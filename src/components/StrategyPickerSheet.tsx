import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStrategies, useCreateStrategy } from '@/hooks/use-strategies';
import { StrategyPlaceholderInline } from '@/components/StrategyPlaceholderInline';
import { spacing, fontSize, borderRadius, useTheme, useThemedStyles, type AppTheme } from '@/lib/theme';
import type { Strategy } from '@/types/strategies';

interface Props {
  visible: boolean;
  selectedStrategies: Strategy[];
  onDone: (strategies: Strategy[]) => void;
  onClose: () => void;
}

export function StrategyPickerSheet({ visible, selectedStrategies, onDone, onClose }: Props) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { colors } = theme;
  const router = useRouter();
  const { data: allStrategies } = useStrategies();
  const createStrategy = useCreateStrategy();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Strategy[]>(selectedStrategies);
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [placeholderDesc, setPlaceholderDesc] = useState('');

  // Reset selection when modal opens
  const [prevVisible, setPrevVisible] = useState(false);
  if (visible && !prevVisible) {
    setSelected(selectedStrategies);
    setSearch('');
    setShowInlineCreate(false);
  }
  if (visible !== prevVisible) setPrevVisible(visible);

  const filtered = useMemo(() => {
    if (!allStrategies) return [];
    const available = allStrategies.filter((s) => s.status !== 'archived');
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter((s) => s.title.toLowerCase().includes(q));
  }, [allStrategies, search]);

  const hasExactMatch = useMemo(() => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return filtered.some((s) => s.title.toLowerCase() === q);
  }, [filtered, search]);

  const isSelected = (id: string) => selected.some((s) => s.id === id);

  const toggle = (strategy: Strategy) => {
    setSelected((prev) =>
      isSelected(strategy.id)
        ? prev.filter((s) => s.id !== strategy.id)
        : [...prev, strategy]
    );
  };

  const handleSavePlaceholder = async () => {
    try {
      const strategy = await createStrategy.mutateAsync({
        title: search.trim(),
        description: placeholderDesc || undefined,
        status: 'active',
      });
      setSelected((prev) => [...prev, strategy]);
      setShowInlineCreate(false);
      setSearch('');
      setPlaceholderDesc('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const handleFullDetails = () => {
    onClose();
    router.push(`/(tabs)/strategies/new?modal=true&title=${encodeURIComponent(search.trim())}`);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Select Strategies</Text>
          <Pressable onPress={() => onDone(selected)}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search or create..."
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
        />

        {/* Strategy list */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => toggle(item)}>
              <View style={styles.rowLeft}>
                {item.emoji ? (
                  <Text style={styles.emoji}>{item.emoji}</Text>
                ) : null}
                <Text style={styles.rowTitle}>{item.title}</Text>
              </View>
              {isSelected(item.id) && (
                <Text style={styles.checkmark}>{'\u2713'}</Text>
              )}
            </Pressable>
          )}
          ListFooterComponent={() => (
            <>
              {/* Create option */}
              {search.trim() && !hasExactMatch && !showInlineCreate && (
                <Pressable
                  style={styles.createRow}
                  onPress={() => setShowInlineCreate(true)}
                >
                  <Text style={styles.createText}>
                    Create &ldquo;{search.trim()}&rdquo;
                  </Text>
                </Pressable>
              )}

              {/* Inline create section */}
              {showInlineCreate && (
                <StrategyPlaceholderInline
                  title={search.trim()}
                  description={placeholderDesc}
                  onDescriptionChange={setPlaceholderDesc}
                  onSave={handleSavePlaceholder}
                  onFullDetails={handleFullDetails}
                  onCancel={() => setShowInlineCreate(false)}
                  isSaving={createStrategy.isPending}
                  placeholderTextColor={colors.textTertiary}
                />
              )}
            </>
          )}
        />
      </View>
    </Modal>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
    },
    doneText: {
      color: colors.primary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    searchInput: {
      margin: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: fontSize.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    emoji: {
      fontSize: 20,
    },
    rowTitle: {
      color: colors.text,
      fontSize: fontSize.md,
    },
    checkmark: {
      color: colors.primary,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    createRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    createText: {
      color: colors.primary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
  });
