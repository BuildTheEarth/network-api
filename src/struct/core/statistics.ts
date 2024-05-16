import DatabaseHandler from "../database.js";
import BuildTeam from "./buildteam.js";
import Network, { AddressType } from "./network.js";

export default class Statistics {

    private static readonly STATISTICS_UPDATE_INTERVAL: number = 60*24;

    private owner: string;

    private network: Network;
    private psDatabase: DatabaseHandler;
    private nwDatabase: DatabaseHandler;

    private stats: Map<string, any> = new Map(); // Map <statistic_name, value>
    private buildTeamStats: Map<BuildTeam, Map<string, any>> = new Map();

    constructor(owner: string, network: Network) {
        this.owner = owner;
        this.network = network;
        this.psDatabase = network.getPlotSystemDatabase();
        this.nwDatabase = network.getNetworkDatabase();
    }

    async updateCache() {
        if(this.nwDatabase.settings.debug || this.psDatabase.settings.debug) {
            console.log("Emptying the cache for player: " + this.owner)
        }

        if(this.stats != null && this.network.getUpdateCacheTicks() % Statistics.STATISTICS_UPDATE_INTERVAL == 0) {
            this.stats.clear();
        }
    }

    async resetCache() {
        this.stats.clear();
    }

    async loadStatisticsData() {
        if(this.nwDatabase.settings.debug || this.psDatabase.settings.debug) {
            console.log("Loading statistics for player: " + this.owner)
        }

        // Get the statistics
        this.stats = await this.getStatisticsFromNetworkDatabase();
    }

    /* =================================================== */
    /*              DATABASE GET REQUESTS                  */
    /* =================================================== */

    private async getStatisticsColumns() {
        const SQL = "SHOW COLUMNS FROM players_stats"
        const [result] = await this.nwDatabase.query(SQL);

        if(result.length == 0)
            return null;
        
        return result
        .map((column: { Field: any; }) => column.Field)
        .filter((column: string) => !['BuildTeam', 'Role', 'UUID', 'HideRole'].includes(column))
        .map((column: any) => `SUM(${column}) AS total_${column}`)
        .join(', ');
    }

    private async getStatisticsFromNetworkDatabase() {
        const statisticsColumns = this.getStatisticsColumns();
        const SQL = `
        SELECT
            UUID,
            ${statisticsColumns}
        FROM
            BuildTeamStats
        WHERE
            UUID = ?
        GROUP BY
            UUID;
        `;

        const result = await this.nwDatabase.query(SQL, [this.owner]);

        if(result.length == 0)
            return null;

        return result;
    }

}