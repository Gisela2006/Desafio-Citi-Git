import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";

// Script de seed (bônus): popula o banco com plantas de exemplo para testar
// as rotas sem cadastrar tudo na mão.
//
// ATENÇÃO: o seed limpa a tabela Planta antes de inserir, para poder ser
// rodado várias vezes e sempre deixar o banco no mesmo estado.
// Com os dados abaixo, GET /plantas/estoque/valor-total responde
// { "valorTotalEmCentavos": 203030, "totalDeVasos": 37 }.

// O `dotenv` puro NÃO expande ${VAR} como o CLI do Prisma faz: lendo o .env
// direto, DATABASE_DB chega como a string "${PROJECT_NAME}" e o Prisma tenta
// conectar no banco errado. Por isso expandimos na mão antes de montar a URL.
// O `npm run seed` já troca DATABASE_HOST para localhost (fora do Docker o
// banco não se chama "treinamento-crud-db").
const expandirVariaveis = (valor: string): string =>
  valor.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, nome: string) => process.env[nome] ?? "");

const montarUrlDoBanco = () => {
  const { DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST, DATABASE_PORT, DATABASE_DB } =
    process.env;

  const usuario = expandirVariaveis(DATABASE_USER ?? "");
  const senha = expandirVariaveis(DATABASE_PASSWORD ?? "");
  const host = expandirVariaveis(DATABASE_HOST ?? "");
  const porta = expandirVariaveis(DATABASE_PORT ?? "");
  const banco = expandirVariaveis(DATABASE_DB ?? "");

  return `postgresql://${usuario}:${senha}@${host}:${porta}/${banco}`;
};

const prisma = new PrismaClient({
  datasources: { db: { url: montarUrlDoBanco() } },
});

const plantas: Prisma.PlantaCreateManyInput[] = [
  {
    nome: "Costela-de-adão",
    especie: "Monstera deliciosa",
    preco: 8990,
    estoque: 12,
    luminosidade: "MEIA_SOMBRA",
    petFriendly: false,
    regaACadaDias: 3,
  },
  {
    nome: "Samambaia",
    especie: "Nephrolepis exaltata",
    preco: 4590,
    estoque: 8,
    luminosidade: "MEIA_SOMBRA",
    petFriendly: true,
    regaACadaDias: 2,
  },
  {
    nome: "Cacto-bola",
    especie: "Echinocactus grusonii",
    preco: 2990,
    estoque: 15,
    luminosidade: "SOL_PLENO",
    petFriendly: true,
    regaACadaDias: 15,
  },
  {
    nome: "Zamioculca",
    especie: "Zamioculcas zamiifolia",
    preco: 6790,
    estoque: 2,
    luminosidade: "SOMBRA",
    petFriendly: false,
    regaACadaDias: 10,
  },
  {
    nome: "Espada-de-são-jorge",
    especie: "Dracaena trifasciata",
    preco: 5490,
    estoque: 0,
    luminosidade: "SOL_PLENO",
    petFriendly: true,
    regaACadaDias: 20,
  },
];

const main = async () => {
  await prisma.planta.deleteMany();
  await prisma.planta.createMany({ data: plantas });

  const total = await prisma.planta.count();
  console.log(`🌱 Seed concluído: ${total} plantas cadastradas.`);
};

main()
  .catch((error) => {
    console.error("❌ Erro ao rodar o seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
