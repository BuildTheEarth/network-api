import DatabaseHandler from "../database.js";
import Network from "./network.js";

export default class PlotSystem {

  private static readonly BUILDERS_UPDATE_INTERVAL: number = 60 * 1; // 1 hour
  private static readonly DIFFICULTIES_UPDATE_INTERVAL: number = 60 * 24; // 24 hours


  private network: Network;
  private plotsystemDatabase: DatabaseHandler;
  private builders: any[] | null = null;
  private difficulties: any[] | null = null;


  constructor(network: Network) {
    this.plotsystemDatabase = network.getPlotSystemDatabase();
    this.network = network;
  }

  // Updates the cache for the build team to make sure the cache is up to date (Called once a minute)
  async updateCache(isStarting: boolean = false) {
    if(this.builders == null || this.network.getUpdateCacheTicks() % PlotSystem.BUILDERS_UPDATE_INTERVAL == 0)
        this.builders = await this.getBuildersFromDatabase();

    if(this.difficulties == null || this.network.getUpdateCacheTicks() % PlotSystem.DIFFICULTIES_UPDATE_INTERVAL == 0)
        this.difficulties = await this.getDifficultiesFromDatabase();
  }

  async resetCache() {
    this.builders = null;
    this.difficulties = null;
  }



  getPSBuilders() {
    if (this.builders == null) {
      this.updateCache();
      return 0;
    }

    return this.builders;
  }

  getPSDifficulties() {
    if (this.difficulties == null) {
      this.updateCache();
      return [];
    }

    return this.difficulties;
  }


  // Get values from database

  async getBuildersFromDatabase() {
    const SQL = "SELECT COUNT(uuid) as builders FROM plotsystem_builders";
    return await this.plotsystemDatabase.query(SQL);
  }

  async getDifficultiesFromDatabase() {
    const SQL = "SELECT * FROM plotsystem_difficulties";
    return await this.plotsystemDatabase.query(SQL);
  }
}
