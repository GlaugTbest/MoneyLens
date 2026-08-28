import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: 'alimentacao', name: 'Alimentação', icon: '🍔' },
  { slug: 'transporte', name: 'Transporte', icon: '🚗' },
  { slug: 'assinaturas', name: 'Assinaturas', icon: '📺' },
  { slug: 'moradia', name: 'Moradia', icon: '🏠' },
  { slug: 'lazer', name: 'Lazer', icon: '🎮' },
  { slug: 'saude', name: 'Saúde', icon: '💊' },
  { slug: 'compras', name: 'Compras', icon: '🛍️' },
  { slug: 'receita', name: 'Receita', icon: '💰' },
  { slug: 'transferencias', name: 'Transferências', icon: '🔁' },
  { slug: 'taxas', name: 'Taxas e Tarifas', icon: '🧾' },
  { slug: 'outros', name: 'Outros', icon: '❔' },
];

// pattern: keyword casado por substring contra normalizedMerchant (já
// normalizado: minúsculo, sem acento, sem sufixos de empresa/pontuação).
const RULES: Array<{ slug: string; matchType: 'MERCHANT_KEYWORD' | 'DESCRIPTION_REGEX'; pattern: string; priority?: number }> = [
  // Transporte
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'uber' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: '99app' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: '99 tecnologia' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'posto' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'ipiranga' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'shell' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'petrobras' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'metro' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'bilhete unico' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'estacionamento' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'localiza' },
  { slug: 'transporte', matchType: 'MERCHANT_KEYWORD', pattern: 'movida' },

  // Alimentação
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'ifood' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'rappi' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'mcdonald' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'burger king' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'kfc' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'subway' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'padaria' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'restaurante' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'lanchonete' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'supermercado' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'carrefour' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'pao de acucar' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'assai' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'extra hiper' },
  { slug: 'alimentacao', matchType: 'MERCHANT_KEYWORD', pattern: 'starbucks' },

  // Assinaturas
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'netflix' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'spotify' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'amazon prime' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'disney' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'hbo' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'youtube premium' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'google play' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'apple.com' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'xbox' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'playstation' },
  { slug: 'assinaturas', matchType: 'MERCHANT_KEYWORD', pattern: 'icloud' },

  // Moradia
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'condominio' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'aluguel' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'cemig' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'enel' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'light sa' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'sabesp' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'comgas' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'vivo' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'claro' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'tim sa' },
  { slug: 'moradia', matchType: 'MERCHANT_KEYWORD', pattern: 'oi sa' },

  // Lazer
  { slug: 'lazer', matchType: 'MERCHANT_KEYWORD', pattern: 'cinemark' },
  { slug: 'lazer', matchType: 'MERCHANT_KEYWORD', pattern: 'ingresso' },
  { slug: 'lazer', matchType: 'MERCHANT_KEYWORD', pattern: 'steam' },
  { slug: 'lazer', matchType: 'MERCHANT_KEYWORD', pattern: 'cinema' },

  // Saúde
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'drogaria' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'droga raia' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'drogasil' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'farmacia' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'unimed' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'hospital' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'clinica' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'smart fit' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'smartfit' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'bio ritmo' },
  { slug: 'saude', matchType: 'MERCHANT_KEYWORD', pattern: 'academia' },

  // Compras
  { slug: 'compras', matchType: 'MERCHANT_KEYWORD', pattern: 'amazon' },
  { slug: 'compras', matchType: 'MERCHANT_KEYWORD', pattern: 'mercado livre' },
  { slug: 'compras', matchType: 'MERCHANT_KEYWORD', pattern: 'magazine luiza' },
  { slug: 'compras', matchType: 'MERCHANT_KEYWORD', pattern: 'americanas' },
  { slug: 'compras', matchType: 'MERCHANT_KEYWORD', pattern: 'shopee' },
  { slug: 'compras', matchType: 'MERCHANT_KEYWORD', pattern: 'aliexpress' },
  { slug: 'compras', matchType: 'MERCHANT_KEYWORD', pattern: 'shein' },

  // Receita / Transferências / Taxas — via descrição (não via merchant)
  { slug: 'receita', matchType: 'DESCRIPTION_REGEX', pattern: 'pix\\s*recebid', priority: 5 },
  { slug: 'receita', matchType: 'DESCRIPTION_REGEX', pattern: 'ted\\s*recebid', priority: 5 },
  { slug: 'receita', matchType: 'DESCRIPTION_REGEX', pattern: 'salario', priority: 5 },
  { slug: 'transferencias', matchType: 'DESCRIPTION_REGEX', pattern: 'pix\\s*enviad', priority: 5 },
  { slug: 'transferencias', matchType: 'DESCRIPTION_REGEX', pattern: 'ted\\s*enviad', priority: 5 },
  { slug: 'transferencias', matchType: 'DESCRIPTION_REGEX', pattern: '^doc\\b', priority: 5 },
  { slug: 'transferencias', matchType: 'DESCRIPTION_REGEX', pattern: 'transferencia', priority: 4 },
  { slug: 'transferencias', matchType: 'DESCRIPTION_REGEX', pattern: 'boleto', priority: 3 },
  { slug: 'taxas', matchType: 'DESCRIPTION_REGEX', pattern: 'tarifa', priority: 5 },
  { slug: 'taxas', matchType: 'DESCRIPTION_REGEX', pattern: '\\biof\\b', priority: 5 },
  { slug: 'taxas', matchType: 'DESCRIPTION_REGEX', pattern: 'anuidade', priority: 5 },
  { slug: 'taxas', matchType: 'DESCRIPTION_REGEX', pattern: 'juros', priority: 5 },
];

async function main() {
  const bySlug = new Map<string, string>();

  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, icon: c.icon, isSystem: true },
      update: { name: c.name, icon: c.icon },
    });
    bySlug.set(c.slug, category.id);
  }

  await prisma.categorizationRule.deleteMany({});
  for (const r of RULES) {
    const categoryId = bySlug.get(r.slug);
    if (!categoryId) throw new Error(`Categoria desconhecida no seed: ${r.slug}`);
    await prisma.categorizationRule.create({
      data: {
        categoryId,
        matchType: r.matchType,
        pattern: r.pattern,
        priority: r.priority ?? 0,
      },
    });
  }

  console.log(`Seed concluído: ${CATEGORIES.length} categorias, ${RULES.length} regras.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
