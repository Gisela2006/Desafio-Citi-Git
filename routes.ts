import express from "express";
import * as UserController from "@controllers/UserController";
import * as PlantaController from "@controllers/PlantaController";

const routes = express.Router();

routes.get("/", (req, res) => {
  res.status(200).json({ message: "API do treinamento de CRUD do CITi 🚀" });
});

// CRUD de usuários
routes.post("/users", UserController.createUser);
routes.get("/users", UserController.readAllUsers);
routes.get("/users/:id", UserController.readUserById);
routes.patch("/users/:id", UserController.updateUser);
routes.delete("/users/:id", UserController.deleteUser);

// CRUD de plantas.
// O Express usa a primeira rota que combinar, então as rotas fixas vêm antes
// de /plantas/:id — senão "esgotadas" seria lido como um id.
routes.post("/plantas", PlantaController.createPlanta);
routes.get("/plantas", PlantaController.readAllPlantas);
routes.get("/plantas/estoque/valor-total", PlantaController.readValorTotalDoEstoque);
routes.get("/plantas/esgotadas", PlantaController.readPlantasEsgotadas);
routes.get("/plantas/:id", PlantaController.readPlantaById);
routes.patch("/plantas/:id", PlantaController.updatePlanta);
routes.delete("/plantas/:id", PlantaController.deletePlanta);
routes.post("/plantas/:id/venda", PlantaController.venderPlanta);

export default routes;
