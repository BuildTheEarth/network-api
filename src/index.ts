import Database from "./struct/database.js";
import Joi from "joi";
import PlotSystem from "./struct/core/plotsystem.js";
import Settings from "./struct/settings.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import Network from "./struct/core/network.js";

const app = express();
const router = express.Router();

// Plot System Imports

const config = new Settings();
const plotsystemDatabase = new Database(config, config.plotsystem_database);
const networkDatabase = new Database(config, config.network_database);

const network = new Network(plotsystemDatabase, networkDatabase);

// Init GET Routes for the API
(await import("./routes/plotsystem/GET_Builders.js")).initRoutes(router, Joi, network.getPlotSystem());
(await import("./routes/plotsystem/GET_Difficulties.js")).initRoutes(
  router,
  Joi,
  network.getPlotSystem()
);

// PlotSystem Imports

(await import("./routes/plotsystem/teams/GET_Cities.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/plotsystem/teams/GET_Countries.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/plotsystem/teams/GET_Plots.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/plotsystem/teams/GET_Reviews.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/plotsystem/teams/GET_Servers.js")).initRoutes(
  router,
  Joi,
  network
);

// Teams Imports

(await import("./routes/teams/GET_Countries.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_Warps.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_Team.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamBlankName.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamContinent.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamDescription.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamHeadID.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamID.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamName.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamOwners.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamServers.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamTag.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/GET_TeamWarps.js")).initRoutes(
  router,
  Joi,
  network
);


// Use the body-parser middleware
//@ts-ignore
router.use(express.json());
// Use CORS & Helmet
router.use(cors());
router.use(helmet());


// Init POST Routes for the API

(await import("./routes/plotsystem/teams/POST_Plots.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/POST_Warp.js")).initRoutes(
  router,
  Joi,
  network
);

// Init PUT Routes for the API
(await import("./routes/plotsystem/teams/PUT_Plots.js")).initRoutes(
  router,
  Joi,
  network
);
(await import("./routes/teams/PUT_Warp.js")).initRoutes(
  router,
  Joi,
  network
);

// Init DELETE Routes for the API
(await import("./routes/teams/DELETE_Warp.js")).initRoutes(
  router,
  Joi,
  network
);


// A timer that runs every 1 minute
setInterval(() => {
  network.updateCache();
}, 1 * 60 * 1000);

app.use("/", router);

// Start the server
app.listen(config.port, () => {
  network.updateCache(true).then(() => {
    notfityAppReady();
  });
});

function notfityAppReady() {
  console.clear();
  console.log(
    "  _   _      _                      _        _    ____ ___ \n" +
      " | \\ | | ___| |___      _____  _ __| | __   / \\  |  _ \\_ _|\n" +
      " |  \\| |/ _ \\ __\\ \\ /\\ / / _ \\| '__| |/ /  / _ \\ | |_) | | \n" +
      " | |\\  |  __/ |_ \\ V  V / (_) | |  |   <  / ___ \\|  __/| | \n" +
      " |_| \\_|\\___|\\__| \\_/\\_/  ___/|_|  |_|\\_\\/_/   \\_\\_|  |___|\n" +
      "\n" +
      "-----------------------------------------------------------------------\n" +
      "NetworkAPI " +
      config.version +
      " by BuildTheEarth\n" +
      "Listening on: http:/localhost:" +
      config.port +
      "\n" +
      "-----------------------------------------------------------------------\n" +
      "\n"
  );
}
