import { Prisma } from "@prisma/client";
import prisma from "@database";

// Uma função por consulta, como no UserRepository.
// O id da planta é número (não uuid/string), então as funções recebem `id: number`.

export const createPlanta = (data: Prisma.PlantaCreateInput) => {
  return prisma.planta.create({ data });
};

export const findAllPlantas = (
  where: Prisma.PlantaWhereInput,
  orderBy: Prisma.PlantaOrderByWithRelationInput
) => {
  return prisma.planta.findMany({ where, orderBy });
};

export const findPlantaById = (id: number) => {
  return prisma.planta.findUnique({ where: { id } });
};

export const updatePlanta = (id: number, data: Prisma.PlantaUpdateInput) => {
  return prisma.planta.update({ where: { id }, data });
};

export const deletePlanta = (id: number) => {
  return prisma.planta.delete({ where: { id } });
};

// Venda atômica: o decremento só acontece se o estoque ainda for suficiente.
// O UPDATE ... WHERE estoque >= quantidade é resolvido pelo banco em uma única
// instrução, então duas vendas simultâneas do último vaso não podem passar as duas.
export const decrementEstoqueIfAvailable = (id: number, quantidade: number) => {
  return prisma.planta.updateMany({
    where: { id, estoque: { gte: quantidade } },
    data: { estoque: { decrement: quantidade } },
  });
};

// O aggregate soma uma coluna, mas não soma preco * estoque.
// Por isso buscamos só as duas colunas e fazemos a conta no controller.
export const findPrecoEEstoqueDeTodas = () => {
  return prisma.planta.findMany({ select: { preco: true, estoque: true } });
};

export const findPlantasEsgotadas = () => {
  return prisma.planta.findMany({
    where: { estoque: 0 },
    orderBy: { nome: "asc" },
  });
};
