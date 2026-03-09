import { z } from 'zod';
import type { Database } from './database';

// ---------- Zod Schemas ----------

const assetClasses = ['crypto', 'stocks', 'options', 'futures', 'forex'] as const;
const sides = ['long', 'short'] as const;
const statuses = ['open', 'closed'] as const;

export const tradeFormSchema = z
  .object({
    symbol: z.string().min(1, 'Symbol is required').transform((s) => s.toUpperCase().trim()),
    asset_class: z.enum(assetClasses).default('crypto'),
    side: z.enum(sides).default('long'),
    status: z.enum(statuses).default('closed'),
    entry_price: z.coerce.number().positive('Entry price must be positive'),
    exit_price: z.coerce.number().positive('Exit price must be positive').optional().nullable(),
    size: z.coerce.number().positive('Size must be positive'),
    fees: z.coerce.number().min(0, 'Fees cannot be negative').default(0),
    entry_date: z.string().min(1, 'Entry date is required'),
    exit_date: z.string().optional().nullable(),
    confidence: z.coerce.number().int().min(1).max(5).optional().nullable(),
    thesis: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    setup_tags: z.array(z.string()).default([]),
    mistake_tags: z.array(z.string()).default([]),
  })
  .refine(
    (data) => {
      if (data.status === 'closed') {
        return data.exit_price != null && data.exit_date != null;
      }
      return true;
    },
    { message: 'Closed trades require exit price and exit date', path: ['exit_price'] }
  )
  .refine(
    (data) => {
      if (data.exit_date && data.entry_date) {
        return new Date(data.exit_date) >= new Date(data.entry_date);
      }
      return true;
    },
    { message: 'Exit date must be after entry date', path: ['exit_date'] }
  );

export type TradeFormData = z.output<typeof tradeFormSchema>;

export const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = authSchema.extend({
  displayName: z.string().min(1, 'Display name is required'),
});

export type AuthFormData = z.infer<typeof authSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;

// ---------- Database Types ----------

export type Trade = Database['public']['Tables']['trades']['Row'];
export type TradeInsert = Database['public']['Tables']['trades']['Insert'];
export type TradeUpdate = Database['public']['Tables']['trades']['Update'];
export type TradeImage = Database['public']['Tables']['trade_images']['Row'];

// ---------- Query Keys ----------

export const tradeKeys = {
  all: ['trades'] as const,
  lists: () => [...tradeKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...tradeKeys.lists(), filters] as const,
  details: () => [...tradeKeys.all, 'detail'] as const,
  detail: (id: string) => [...tradeKeys.details(), id] as const,
  tags: () => [...tradeKeys.all, 'tags'] as const,
  stats: (filters: Record<string, unknown>) => [...tradeKeys.all, 'stats', filters] as const,
};
