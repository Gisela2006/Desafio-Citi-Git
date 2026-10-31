import { Request, Response } from "express";
import { Luminosidade, Prisma } from "@prisma/client";
import * as PlantaRepository from "@repositories/PlantaRepository";

// O controller recebe a requisição, valida os dados, aplica as regras de
// negócio, chama o repository e decide qual status HTTP e qual corpo devolver.

// Lido do próprio Prisma Client: se o enum mudar no schema.prisma, a
// validação passa a aceitar os valores novos sem mexer no controller.
const LUMINOSIDADES: string[] = Object.values(Luminosidade);

const CAMPOS_DA_PLANTA = [
  "nome",
  "especie",
  "preco",
  "estoque",
  "luminosidade",
  "petFriendly",
  "regaACadaDias",
] as const;

type CampoDaPlanta = (typeof CAMPOS_DA_PLANTA)[number];

// Todos os campos são opcionais aqui porque, no PATCH, nada é obrigatório.
// Quem exige os campos todos é o parâmetro `exigirTodos` da validação.
type DadosDaPlanta = {
  nome?: string;
  especie?: string;
  preco?: number;
  estoque?: number;
  luminosidade?: Luminosidade;
  petFriendly?: boolean;
  regaACadaDias?: number;
};

type PlantaCompleta = Required<DadosDaPlanta>;

type RegraDeValidacao = {
  valida: (valor: unknown) => boolean;
  mensagem: string;
};

// Repare nas comparações: nunca usamos `!valor` para saber se o campo veio,
// porque `!0` e `!false` são `true` e recusariam estoque 0 e petFriendly false,
// que são valores válidos. A checagem de ausência é sempre `valor === undefined`.
const REGRAS: Record<CampoDaPlanta, RegraDeValidacao> = {
  nome: {
    valida: (valor) => typeof valor === "string" && valor.trim() !== "",
    mensagem: "O campo nome é obrigatório e deve ser um texto não vazio.",
  },
  especie: {
    valida: (valor) => typeof valor === "string" && valor.trim() !== "",
    mensagem: "O campo especie é obrigatório e deve ser um texto não vazio.",
  },
  preco: {
    // Number.isInteger recusa "8990", 89.9, NaN e Infinity.
    valida: (valor) => typeof valor === "number" && Number.isInteger(valor) && valor > 0,
    mensagem:
      "O campo preco deve ser um número inteiro maior que zero (o valor em centavos, por exemplo 8990).",
  },
  estoque: {
    valida: (valor) => typeof valor === "number" && Number.isInteger(valor) && valor >= 0,
    mensagem: "O campo estoque deve ser um número inteiro maior ou igual a zero.",
  },
  luminosidade: {
    valida: (valor) => typeof valor === "string" && LUMINOSIDADES.includes(valor),
    mensagem: `O campo luminosidade deve ser um dos valores: ${LUMINOSIDADES.join(", ")}.`,
  },
  petFriendly: {
    valida: (valor) => typeof valor === "boolean",
    mensagem: "O campo petFriendly deve ser true ou false.",
  },
  regaACadaDias: {
    valida: (valor) => typeof valor === "number" && Number.isInteger(valor) && valor >= 1,
    mensagem: "O campo regaACadaDias deve ser um número inteiro maior ou igual a 1.",
  },
};

type ResultadoValidacao =
  | { ok: true; dados: DadosDaPlanta }
  | { ok: false; mensagem: string };

// A mesma função valida POST e PATCH: no POST todos os campos são exigidos,
// no PATCH só os que vieram, mas qualquer campo enviado passa pelas mesmas regras.
const validarDadosDaPlanta = (corpo: unknown, exigirTodos: boolean): ResultadoValidacao => {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    return { ok: false, mensagem: "Envie um corpo JSON com os dados da planta." };
  }

  const campos = corpo as Record<string, unknown>;

  if (exigirTodos) {
    const faltando = CAMPOS_DA_PLANTA.filter((campo) => campos[campo] === undefined);
    if (faltando.length > 0) {
      return {
        ok: false,
        mensagem: `Campos obrigatórios não enviados: ${faltando.join(", ")}.`,
      };
    }
  }

  const dados: Record<string, unknown> = {};

  for (const campo of CAMPOS_DA_PLANTA) {
    const valor = campos[campo];

    // Campo não enviado: no PATCH ele fica como está no banco.
    if (valor === undefined) continue;

    const regra = REGRAS[campo];

    if (!regra.valida(valor)) {
      return { ok: false, mensagem: regra.mensagem };
    }

    // Textos são gravados sem espaço sobrando nas pontas.
    dados[campo] = typeof valor === "string" ? valor.trim() : valor;
  }

  return { ok: true, dados: dados as DadosDaPlanta };
};

// O :id da rota chega como texto, então convertemos e conferimos.
const lerId = (req: Request): number | null => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const ERRO_ID = "O id da planta deve ser um número inteiro positivo.";

type FiltrosDasPlantas = {
  where: Prisma.PlantaWhereInput;
  orderBy: Prisma.PlantaOrderByWithRelationInput;
};

// Os filtros chegam em req.query e são sempre texto: ?petFriendly=true chega
// como a string "true". Filtro ausente (undefined) não entra no `where`.
const lerFiltros = (query: Request["query"]): FiltrosDasPlantas | { erro: string } => {
  const { luminosidade, petFriendly, nome, ordem } = query;

  const where: Prisma.PlantaWhereInput = {};

  if (luminosidade !== undefined) {
    if (typeof luminosidade !== "string" || !LUMINOSIDADES.includes(luminosidade)) {
      return { erro: `O filtro luminosidade deve ser um dos valores: ${LUMINOSIDADES.join(", ")}.` };
    }
    where.luminosidade = luminosidade as Luminosidade;
  }

  if (petFriendly !== undefined) {
    if (petFriendly !== "true" && petFriendly !== "false") {
      return { erro: 'O filtro petFriendly deve ser "true" ou "false".' };
    }
    where.petFriendly = petFriendly === "true";
  }

  if (nome !== undefined && nome !== "") {
    if (typeof nome !== "string") {
      return { erro: "O filtro nome deve ser um texto." };
    }
    // Bônus: busca sem diferenciar maiúsculas de minúsculas.
    where.nome = { contains: nome.trim(), mode: "insensitive" };
  }

  let orderBy: Prisma.PlantaOrderByWithRelationInput = { id: "asc" };

  if (ordem !== undefined) {
    if (ordem !== "preco" && ordem !== "nome") {
      return { erro: 'O filtro ordem deve ser "preco" ou "nome".' };
    }
    orderBy = ordem === "preco" ? { preco: "asc" } : { nome: "asc" };
  }

  return { where, orderBy };
};

export const createPlanta = async (req: Request, res: Response) => {
  try {
    const validacao = validarDadosDaPlanta(req.body, true);

    if (!validacao.ok) {
      return res.status(400).json({ message: validacao.mensagem });
    }

    // Só os campos da planta vão para o banco (nunca o req.body inteiro).
    const dados = validacao.dados as PlantaCompleta;

    const planta = await PlantaRepository.createPlanta({
      nome: dados.nome,
      especie: dados.especie,
      preco: dados.preco,
      estoque: dados.estoque,
      luminosidade: dados.luminosidade,
      petFriendly: dados.petFriendly,
      regaACadaDias: dados.regaACadaDias,
    });

    return res.status(201).json(planta);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao cadastrar planta." });
  }
};

export const readAllPlantas = async (req: Request, res: Response) => {
  try {
    const filtros = lerFiltros(req.query);

    if ("erro" in filtros) {
      return res.status(400).json({ message: filtros.erro });
    }

    // Um filtro válido que não encontra nada devolve 200 com [], nunca 404.
    const plantas = await PlantaRepository.findAllPlantas(filtros.where, filtros.orderBy);

    return res.status(200).json(plantas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao listar plantas." });
  }
};

export const readPlantaById = async (req: Request, res: Response) => {
  try {
    const id = lerId(req);

    if (id === null) {
      return res.status(400).json({ message: ERRO_ID });
    }

    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }

    return res.status(200).json(planta);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar planta." });
  }
};

export const updatePlanta = async (req: Request, res: Response) => {
  try {
    const id = lerId(req);

    if (id === null) {
      return res.status(400).json({ message: ERRO_ID });
    }

    // Antes de editar garantimos que a planta existe: sem isso o erro do
    // Prisma cairia no catch e viraria um 500, quando o certo é 404.
    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }

    const validacao = validarDadosDaPlanta(req.body, false);

    if (!validacao.ok) {
      return res.status(400).json({ message: validacao.mensagem });
    }

    if (Object.keys(validacao.dados).length === 0) {
      return res.status(400).json({ message: "Envie ao menos um campo para atualizar." });
    }

    const atualizada = await PlantaRepository.updatePlanta(
      id,
      validacao.dados as Prisma.PlantaUpdateInput
    );

    return res.status(200).json(atualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao atualizar planta." });
  }
};

export const deletePlanta = async (req: Request, res: Response) => {
  try {
    const id = lerId(req);

    if (id === null) {
      return res.status(400).json({ message: ERRO_ID });
    }

    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }

    await PlantaRepository.deletePlanta(id);

    // 204 No Content: deu certo e não há corpo para devolver.
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao deletar planta." });
  }
};

export const venderPlanta = async (req: Request, res: Response) => {
  try {
    const id = lerId(req);

    if (id === null) {
      return res.status(400).json({ message: ERRO_ID });
    }

    const { quantidade } = (req.body ?? {}) as { quantidade?: unknown };

    if (typeof quantidade !== "number" || !Number.isInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({
        message: "O campo quantidade deve ser um número inteiro maior que zero.",
      });
    }

    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }

    // Decremento condicional: o banco só desconta se ainda houver estoque
    // suficiente. Se duas pessoas comprarem o último vaso ao mesmo tempo,
    // uma venda passa e a outra recebe 400, nunca estoque negativo.
    const { count } = await PlantaRepository.decrementEstoqueIfAvailable(id, quantidade);

    if (count === 0) {
      const atual = await PlantaRepository.findPlantaById(id);

      if (!atual) {
        return res.status(404).json({ message: "Planta não encontrada." });
      }

      return res.status(400).json({
        message: `Estoque insuficiente: temos só ${atual.estoque} vaso(s) de ${atual.nome}.`,
      });
    }

    const atualizada = await PlantaRepository.findPlantaById(id);

    return res.status(200).json(atualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao registrar venda." });
  }
};

export const readValorTotalDoEstoque = async (_req: Request, res: Response) => {
  try {
    const plantas = await PlantaRepository.findPrecoEEstoqueDeTodas();

    // O aggregate do Prisma soma uma coluna, não preco * estoque,
    // então a conta é feita aqui, em centavos inteiros.
    const valorTotalEmCentavos = plantas.reduce((total, planta) => {
      return total + planta.preco * planta.estoque;
    }, 0);

    const totalDeVasos = plantas.reduce((total, planta) => {
      return total + planta.estoque;
    }, 0);

    // Loja vazia responde 200 com os dois valores zerados.
    return res.status(200).json({ valorTotalEmCentavos, totalDeVasos });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao calcular o valor total do estoque." });
  }
};

export const readPlantasEsgotadas = async (_req: Request, res: Response) => {
  try {
    const plantas = await PlantaRepository.findPlantasEsgotadas();

    return res.status(200).json(plantas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar plantas esgotadas." });
  }
};
