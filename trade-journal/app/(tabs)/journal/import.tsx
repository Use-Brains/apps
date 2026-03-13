import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { MappingTable } from '@/components/import/MappingTable';
import { PreviewSummary } from '@/components/import/PreviewSummary';
import { ConflictReviewTable } from '@/components/import/ConflictReviewTable';
import { ImportResultCard } from '@/components/import/ImportResultCard';
import { useTradeImport, type ParsedImportSession, type PreviewImportSession } from '@/hooks/use-trade-import';
import type { ImportResolution } from '@/features/import/types';
import { fontSize, spacing, borderRadius, fontWeight, useTheme, useThemedStyles, type AppTheme } from '@/lib/theme';

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export default function ImportCsvScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { parseFile, buildPreview, execute, executing } = useTradeImport();

  const [fileName, setFileName] = useState<string>('');
  const [timeZone, setTimeZone] = useState(DEFAULT_TIMEZONE);
  const [session, setSession] = useState<ParsedImportSession | null>(null);
  const [preview, setPreview] = useState<PreviewImportSession | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, ImportResolution>>({});
  const [report, setReport] = useState<Awaited<ReturnType<typeof execute>> | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileUri, setFileUri] = useState('');

  const validRows = useMemo(
    () => preview?.rowResults.filter((row) => row.normalized).length ?? 0,
    [preview]
  );

  const pickFile = async () => {
    try {
      setLoadingFile(true);
      setPreview(null);
      setReport(null);

      const picker = File as unknown as {
        pickFileAsync?: () => Promise<{ uri: string; name?: string } | null>;
      };

      let picked: { uri: string; name?: string } | null = null;
      if (typeof picker.pickFileAsync === 'function') {
        picked = await picker.pickFileAsync();
      } else if (fileUri.trim()) {
        picked = { uri: fileUri.trim(), name: fileUri.split('/').pop() };
      }

      if (!picked?.uri) {
        Alert.alert(
          'File Picker Unavailable',
          'This runtime does not expose a file picker. Paste a local CSV URI and try again.'
        );
        return;
      }

      const parsed = await parseFile(picked.uri);
      setFileName(picked.name ?? 'import.csv');
      setSession(parsed);
      setResolutions({});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read CSV file.';
      Alert.alert('Import Error', message);
    } finally {
      setLoadingFile(false);
    }
  };

  const runPreview = async () => {
    if (!session) return;

    try {
      setLoadingPreview(true);
      const nextPreview = await buildPreview({
        dataRows: session.dataRows,
        columns: session.columns,
        bindings: session.bindings,
        timeZone,
      });
      setPreview(nextPreview);

      const defaults = nextPreview.conflicts.reduce<Record<number, ImportResolution>>((acc, conflict) => {
        acc[conflict.importRowIndex] = 'skip';
        return acc;
      }, {});
      setResolutions(defaults);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build preview.';
      Alert.alert('Preview Error', message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;

    try {
      const nextReport = await execute({
        preview,
        resolutions,
      });
      setReport(nextReport);
      Alert.alert('Import Complete', 'CSV import finished.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      Alert.alert('Import Error', message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Import Trades CSV</Text>
        <Text style={styles.subtitle}>Deterministic import with manual mapping fallback</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Step 1: Select CSV File</Text>
        <Pressable style={styles.primaryButton} onPress={pickFile} disabled={loadingFile}>
          {loadingFile ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Pick CSV File</Text>
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          value={fileUri}
          onChangeText={setFileUri}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Optional fallback: local CSV URI"
          placeholderTextColor={colors.textTertiary}
        />
        {!!fileName && <Text style={styles.meta}>Selected: {fileName}</Text>}
      </View>

      {session && (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Step 2: Confirm Mapping</Text>
            {!session.hasHeader && (
              <Text style={styles.warning}>No headers detected. Manual mapping is required.</Text>
            )}
            <MappingTable
              bindings={session.bindings}
              onChange={(nextBindings) => setSession({ ...session, bindings: nextBindings })}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Step 3: Timezone for Date Parsing</Text>
            <TextInput
              style={styles.input}
              value={timeZone}
              onChangeText={setTimeZone}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="America/Los_Angeles"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable
              style={styles.primaryButton}
              onPress={runPreview}
              disabled={loadingPreview}
            >
              {loadingPreview ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.primaryButtonText}>Build Preview</Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      {preview && (
        <>
          <PreviewSummary
            totalRows={preview.rowResults.length}
            validRows={validRows}
            invalidRows={preview.skippedInvalid}
            conflicts={preview.conflicts.length}
            timeZone={timeZone}
          />

          <ConflictReviewTable
            conflicts={preview.conflicts}
            resolutions={resolutions}
            onChangeResolution={(rowIndex, resolution) =>
              setResolutions((prev) => ({ ...prev, [rowIndex]: resolution }))
            }
          />

          <Pressable
            style={[styles.primaryButton, executing && styles.buttonDisabled]}
            onPress={runImport}
            disabled={executing}
          >
            {executing ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>Execute Import</Text>
            )}
          </Pressable>
        </>
      )}

      {report && <ImportResultCard report={report} />}

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  warning: {
    fontSize: fontSize.xs,
    color: colors.warning,
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
