import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import type { ReactNode } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '../lib/theme'

export function Card({ title, icon, children, style }: {
  title?: string
  icon?: keyof typeof Ionicons.glyphMap
  children: ReactNode
  style?: any
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.cardTitleRow}>
          {icon ? <Ionicons name={icon} size={15} color={colors.text} /> : null}
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  )
}

export function Chip({ label, active, onPress, color }: {
  label: string
  active?: boolean
  onPress?: () => void
  color?: string
}) {
  const tint = color ?? colors.primary
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: tint, borderColor: tint },
      ]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>
}

export function Button({ label, onPress, icon, variant = 'primary', disabled }: {
  label: string
  onPress: () => void
  icon?: keyof typeof Ionicons.glyphMap
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}) {
  const bg =
    variant === 'primary' ? colors.primary
    : variant === 'danger' ? colors.danger
    : colors.primarySoft
  const fg = variant === 'secondary' ? colors.primary : '#fff'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor: bg }, disabled && { opacity: 0.45 }]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  )
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={[styles.input, props.multiline && { height: 80, textAlignVertical: 'top' }, props.style]}
    />
  )
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>
}

export function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: 'bold', color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: '#f6f8fc',
  },
  chipText: { fontSize: 12, color: colors.textSub, fontWeight: '600' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  buttonText: { fontSize: 14, fontWeight: 'bold' },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSub, marginBottom: 5 },
  fieldHint: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  input: {
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: '#fbfcfe',
    borderRadius: radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  empty: { fontSize: 13, color: colors.textFaint, paddingVertical: 6 },
  divider: { height: 0.5, backgroundColor: colors.border, marginVertical: 10 },
})
