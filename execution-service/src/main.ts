import * as dotenv from "dotenv";
import { configService } from "./config/execution-config.service";
import express from "express";
import cors from "cors";
import router from "./task/execute-task.controller";
import { init } from "./utils/mcl";

dotenv.config();

async function bootstrap() {
    await init();
    const app = express();
    const port = configService.config.service.port;

    app.use(cors());
    app.use(express.json());
    app.use("/task", router);

    app.listen(port, () => {
        console.log(`Execution Service is running on port ${port}`);
    });
}

bootstrap();
