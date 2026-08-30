import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  PLUGGY_CLIENT_ID: z.string().optional(),
  PLUGGY_CLIENT_SECRET: z.string().optional(),
  PLUGGY_BASE_URL: z.string().default('https://api.pluggy.ai'),
  PLUGGY_WEBHOOK_URL: z.string().optional(),
  PLUGGY_WEBHOOK_SECRET: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  ENABLE_LLM_CATEGORIZATION: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

// Em produção, o segredo do webhook é obrigatório: sem ele, o endpoint público
// de webhook aceitaria qualquer payload (fail-open). Falhar o boot é melhor
// que subir com autenticação de webhook desligada por engano.
export const envSchema = baseSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && !data.PLUGGY_WEBHOOK_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PLUGGY_WEBHOOK_SECRET'],
      message: 'Obrigatório em produção — sem ele, o webhook aceitaria qualquer requisição.',
    });
  }
});

export type Env = z.infer<typeof baseSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Config inválida: ${parsed.error.toString()}`);
  }
  return parsed.data;
}
