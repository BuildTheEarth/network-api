import DatabaseHandler from "../database.js";
import Network from "./network.js";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';


export default class BuildTeam {
    private static readonly CITY_UPDATE_INTERVAL: number = 60 * 24; // 24 hours
    private static readonly COUNTRY_UPDATE_INTERVAL: number = 60 * 24; // 24 hours
    private static readonly SERVER_UPDATE_INTERVAL: number = 60 * 24; // 24 hours
    private static readonly FTP_CONFIGURATION_UPDATE_INTERVAL: number = 60 * 24; // 24 hours
    private static readonly BUILD_TEAM_INFO_UPDATE_INTERVAL: number = 60 * 1; // 1 hour


    private apiKey: string;
    private buildTeamID: string | null = null;
    private network: Network;
    private psDatabase: DatabaseHandler
    private nwDatabase: DatabaseHandler

    private psCities: Map<number, any[]> = new Map() // Map<country_id, city>
    private psCountries: Map<number, any[]> = new Map() // Map<country_id, country>
    private psServers: Map<number, any[]> = new Map() // Map<server_id, server>
    private psFTPConfiguration: Map<number, any[]> = new Map(); // Map<server_id, ftp_configuration>

    private buildTeamInfo: any | null = null;


    constructor(apiKey: string, network: Network) {
        this.apiKey = apiKey;
        this.network = network;
        this.psDatabase = network.getPlotSystemDatabase();
        this.nwDatabase = network.getNetworkDatabase();
    }


    // Updates the cache for the build team
    async updateCache(){
        if(this.psDatabase.settings.debug)
            console.log("Updating cache for build team: " + this.apiKey)
        

        if(this.psCities != null && this.network.getUpdateCacheTicks() % BuildTeam.CITY_UPDATE_INTERVAL == 0)
            this.psCities.clear();

        if(this.psCountries != null && this.network.getUpdateCacheTicks() % BuildTeam.COUNTRY_UPDATE_INTERVAL == 0)
            this.psCountries.clear();
            
        if(this.psServers != null && this.network.getUpdateCacheTicks() % BuildTeam.SERVER_UPDATE_INTERVAL == 0)
            this.psServers.clear();

        if(this.psFTPConfiguration != null && this.network.getUpdateCacheTicks() % BuildTeam.FTP_CONFIGURATION_UPDATE_INTERVAL == 0)
            this.psFTPConfiguration.clear();

        if(this.buildTeamInfo != null && this.network.getUpdateCacheTicks() % BuildTeam.BUILD_TEAM_INFO_UPDATE_INTERVAL == 0)
            this.buildTeamInfo = null;
    }

    async loadBuildTeamData(){
        if(this.psDatabase.settings.debug)
            console.log("Loading data for build team: " + this.apiKey)

        // Get the build team information
        this.buildTeamID = await this.getBuildTeamIDFromDatabase();
        this.buildTeamInfo = await this.getBuildTeamInfoFromDatabase();

        if(this.buildTeamID == undefined || this.buildTeamID == null)
            return;


        // Update all countries, cities, servers and ftp configurations
        const countries = await this.getPSCountriesFromDatabase();

        // Loop through all countries
        for(const country of countries){
            const cities = await this.getPSCitiesFromDatabase(country.id);
            const servers = await this.getPSServersFromDatabase(country.id);

            // Update all servers and ftp configurations
            for(const server of servers){
                const ftpConfiguration = await this.getPSFTPConfigurationFromDatabase(server.id);

                this.psServers.set(server.id, server);
                this.psFTPConfiguration.set(server.id, ftpConfiguration);
            }

            this.psCities.set(country.id, cities);
            this.psCountries.set(country.id, country);
        }
    }



    /* ======================================= */
    /*              BuildTeam                  */
    /* ======================================= */

    /** Returns information about the build team. 
        If key is null, all information is returned, otherwise only the information for the given key is returned. 
        If no information is found, null is returned.*/
    async getBuildTeamInfo(key: string | null){
        if(this.buildTeamInfo == null)
            await this.loadBuildTeamData();

        if(key == null)
            return this.buildTeamInfo[0];

        if(!this.buildTeamInfo[0].hasOwnProperty(key))
            return null;

        return this.buildTeamInfo[0][key];
    }

    /** Creates a new warp for the build team.
     * 
     * @param key The key of the warp
     * @param countryCode Country Code that matches the countryCodeType
     * @param countryCodeType Country Code Type like cca2, cca3, ccn3, or cioc
     * @param subRegion Name of the the subregion like state or province.
     * @param city Name of the city
     * @param worldName The name of the world the warp is in
     * @param lat The latitude of the warp
     * @param lon The longitude of the warp
     * @param y The y coordinate of the warp
     * @param yaw The yaw of the warp
     * @param pitch The pitch of the warp
     * @param isHighlight Whether the warp is a highlight or not
     * 
     * @returns Returns true if the warp was created successfully, otherwise false.
     **/
    async createWarp(key: string, countryCode: string, countryCodeType: string, subRegion: string, city: string, worldName: string, lat: number, lon: number, y: number, yaw: number, pitch: number, isHighlight: boolean) {
        const randomId: string = uuidv4();

        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();
        if(this.buildTeamID == null)
            return false;

        // Convert the country code to cca3 if needed
        let finalCountryCode: string = countryCode;

        if(countryCodeType == "cca2" || countryCodeType == "ccn3" || countryCodeType == "cioc"){
            const filePath = path.join(process.cwd(), 'lib', 'countries.json');
            const rawData = await fs.readFile(filePath, 'utf-8');
            const countriesData = JSON.parse(rawData);
            let found = false;

            for (const countryData of countriesData) 
                if(countryCodeType == "cca2" && countryData.cca2 == countryCode){
                    finalCountryCode = countryData.cca3;
                    found = true;
                    break;
                }else if(countryCodeType == "ccn3" && countryData.ccn3 == countryCode){
                    finalCountryCode = countryData.cca3
                    found = true;
                    break;
                }else if(countryCodeType == "cioc" && countryData.cioc == countryCode){
                    finalCountryCode = countryData.cca3;
                    found = true;
                    break;
                }

            if(!found)
                return false;
        }
        
        return await this.createWarpInDatabase(randomId, this.buildTeamID, key, finalCountryCode, subRegion, city, worldName, lat, lon, y, yaw, pitch, isHighlight);
    }


    /** Updates an existing warp of the build team.
     * 
     * @param ID The ID of the warp
     * @param key The key of the warp
     * @param countryCode Country Code that matches the countryCodeType
     * @param countryCodeType Country Code Type like cca2, cca3, ccn3, or cioc
     * @param subRegion Name of the the subregion like state or province.
     * @param city Name of the city
     * @param worldName The name of the world the warp is in
     * @param lat The latitude of the warp
     * @param lon The longitude of the warp
     * @param y The y coordinate of the warp
     * @param yaw The yaw of the warp
     * @param pitch The pitch of the warp
     * @param isHighlight Whether the warp is a highlight or not
     * 
     * @returns Returns true if the warp was created successfully, otherwise false.
     **/
    async updateWarp(ID: string, key: string, countryCode: string, countryCodeType: string, subRegion: string, city: string, worldName: string, lat: number, lon: number, y: number, yaw: number, pitch: number, isHighlight: boolean) {
        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();
        if(this.buildTeamID == null)
            return false;

        // Check if the warp exists
        const warps = await this.getWarps();
        const warp = warps.find((warp: any) => warp.ID == ID);

        // If the warp was not found, return an error
        if(warp == null){
            return false;
        }


        // Convert the country code to cca3 if needed
        let finalCountryCode: string = countryCode;

        if(countryCodeType == "cca2" || countryCodeType == "ccn3" || countryCodeType == "cioc"){
            const filePath = path.join(process.cwd(), 'lib', 'countries.json');
            const rawData = await fs.readFile(filePath, 'utf-8');
            const countriesData = JSON.parse(rawData);
            let found = false;

            for (const countryData of countriesData) 
                if(countryCodeType == "cca2" && countryData.cca2 == countryCode){
                    finalCountryCode = countryData.cca3;
                    found = true;
                    break;
                }else if(countryCodeType == "ccn3" && countryData.ccn3 == countryCode){
                    finalCountryCode = countryData.cca3
                    found = true;
                    break;
                }else if(countryCodeType == "cioc" && countryData.cioc == countryCode){
                    finalCountryCode = countryData.cca3;
                    found = true;
                    break;
                }

            if(!found)
                return false;
        }

        return await this.updateWarpInDatabase(ID, this.buildTeamID, key, finalCountryCode, subRegion, city, worldName, lat, lon, y, yaw, pitch, isHighlight);
    }


    /** Deletes a warp from the build team.
     * 
     * @param key The name or ID of the warp
     */
    async deleteWarp(key: string) {
        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();

        if(this.buildTeamID == null)
            return false;

        return await this.deleteWarpInDatabase(key);
    }

    /** Returns a list of warps based on the build team id. If no warps are found, an empty list is returned.*/
    async getWarps(){
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();

        if(this.buildTeamID == null)
            return [];
    
        const result = await this.network.getWarps();

        if(result == null)
            return [];

        return result.filter((warp: any) => warp.BuildTeam == this.buildTeamID);
    }



    /* ======================================= */
    /*              PlotSystem                 */
    /* ======================================= */


    // Returns a list of cities. If no cities are found, an empty list is returned.
    async getPSCities(){
        if(this.psCities == null || this.psCities.size == 0)
            await this.loadBuildTeamData();

        const cities: any[] = [];
        for(const city of this.psCities.values())
            cities.push(...city);

        return cities;
    }

    // Returns a list of cities for the given country id. If the country id is not found, an empty list is returned.
    async getPSCitiesByCountry(country_id: number){
        if(this.psCities == null || this.psCities.size == 0)
            await this.loadBuildTeamData();

        if(!this.psCities.has(country_id))
            return [];

        return this.psCities.get(country_id);
    }

    // Returns a map of countries with the country id as the key. If no countries are found, an empty map is returned.
    async getPSCountries(){
        if(this.psCountries == null || this.psCountries.size == 0)
            await this.loadBuildTeamData();

        return this.psCountries;
    }


    // Returns a map of servers with the server id as the key. If no servers are found, an empty map is returned.
    async getPSServers(){
        if(this.psServers == null || this.psServers.size == 0)
            await this.loadBuildTeamData();
            
        return this.psServers;
    }

    // Returns a map of ftp configurations with the server id as the key. If no ftp configurations are found, an empty map is returned.
    async getPSFTPConfiguration(){
        if(this.psFTPConfiguration == null || this.psFTPConfiguration.size == 0)
            await this.loadBuildTeamData();

        return this.psFTPConfiguration;        
    }

    // Returns an uncached list of plots of this team. If no plots are found, an empty list is returned.
    async getPSPlots(){
        if(this.psCities == null || this.psCities.size == 0)
            await this.loadBuildTeamData();

        const plots: any[] = [];
        for(const city of await this.getPSCities()){
            const cityPlots = await this.getPSPlotsByCity(city.id);
            plots.push(...cityPlots);
        }

        return plots;
    }

    // Checks if the given plot id is valid for this team. If the plot id is not found, false is returned.
    async isValidPSPlot(plot_id: number){
        if(this.psCities == null || this.psCities.size == 0)
            await this.loadBuildTeamData();

        for(const city of await this.getPSCities()){
            const cityPlots = await this.getPSPlotsByCity(city.id);
            if(cityPlots.some((plot: {id: number}) => plot.id == plot_id))
                return true;
        }

        return false;
    }

    // Returns a plot for the given plot id. If the plot id is not found, null is returned.
    async getPSPlot(plot_id: number){
        if(this.psCities == null || this.psCities.size == 0)
            await this.loadBuildTeamData();

        for(const plot of await this.getPSPlots())
        if(plot.id == plot_id)
            return plot;

        return null;
    }

    // Returns an uncached list of plots for the given city id. If the city id is not found, an empty list is returned. 
    async getPSPlotsByCity(city_id: number){
        if(!this.psCities.has(city_id))
            return [];

        return await this.getPSCityPlotsFromDatabase(city_id);        
    }

    // Creates a new plot for the given city id. If the city id is not found, false is returned.
    async createPSPlot(city_project_id: number, difficulty_id: number, mc_coordinates: [number, number, number], outline: any, create_player: string, version: string){
        const cities = await this.getPSCities();
        
        if(!cities.some(city => city.id == city_project_id))
            return false;

        return await this.createPSPlotInDatabase(city_project_id, difficulty_id, mc_coordinates, outline, create_player, version);
    }

    // Updates the plot with the given plot id. If the plot id is not found, false is returned.
    async updatePSPlot(plot_id: number, city_project_id: number, difficulty_id: number, review_id: number, owner_uuid: string, member_uuids: string[], status: any, mc_coordinates: [number, number, number], outline: any, score: string, last_activity: string, pasted: string, type: string, version: string){
        if(!this.isValidPSPlot(plot_id))
            return false;

        return await this.updatePSPlotInDatabase(plot_id, city_project_id, difficulty_id, review_id, owner_uuid, member_uuids, status, mc_coordinates, outline, score, last_activity, pasted, type, version);
    }

    // Returns an uncached list of reviews.
    async getPSReviews(){
        if(this.psCities == null || this.psCities.size == 0)
            await this.loadBuildTeamData();

        const reviews: any[] = [];
        for(const city of await this.getPSCities()){
            const cityReviews = await this.getPSReviewsByCity(city.id);
            reviews.push(...cityReviews);
        }

        return reviews;
    }

    // Returns an uncached list of plots for the given city id. If the city id is not found, an empty list is returned. 
    async getPSReviewsByCity(city_id: number){
        if(!this.psCities.has(city_id))
            return [];

        return await this.getPSCityReviewsFromDatabase(city_id);        
    }

    

    /* =================================================== */
    /*              DATABASE GET REQUESTS                  */
    /* =================================================== */

    async getBuildTeamIDFromDatabase(){
        const SQL = "SELECT ID as btid FROM BuildTeams WHERE APIKey = ?";
        const result = await this.nwDatabase.query(SQL, [this.apiKey]);

        if(result.length == 0)
            return null;

        return result[0].btid;
    }
    
    async getPSCountriesFromDatabase(){
        const SQL = "SELECT a.* FROM plotsystem_countries as a, plotsystem_buildteam_has_countries as b WHERE buildteam_id = ? AND a.id = b.country_id";
        return await this.psDatabase.query(SQL, [this.buildTeamID]);
    }

    async getPSCitiesFromDatabase(country_id: number){
        const SQL = "SELECT * FROM plotsystem_city_projects WHERE country_id = ?";
        return await this.psDatabase.query(SQL, [country_id]);
    }

    async getPSServersFromDatabase(country_id: number){
        const SQL = "SELECT * FROM plotsystem_servers WHERE id = (SELECT server_id FROM plotsystem_countries WHERE id = ?)";
        return await this.psDatabase.query(SQL, [country_id]);
    }

    async getPSFTPConfigurationFromDatabase(server_id: number){
        const SQL = "SELECT * FROM plotsystem_ftp_configurations as a WHERE a.id = (SELECT ftp_configuration_id FROM plotsystem_servers as b WHERE b.id = ?)";
        return await this.psDatabase.query(SQL, [server_id]);
    }

    async getPSCityPlotsFromDatabase(city_id: number){
        const SQL = "SELECT * FROM plotsystem_plots WHERE city_project_id = ?";
        return await this.psDatabase.query(SQL, [city_id]);
    }

    async getPSCityReviewsFromDatabase(city_id: number){
        const SQL = "SELECT a.* FROM plotsystem_reviews as a, plotsystem_plots as b WHERE a.id = b.review_id";
        return await this.psDatabase.query(SQL, [city_id]);
    }

    async getBuildTeamInfoFromDatabase() {
        let SQL = "SELECT * FROM BuildTeams WHERE APIKey = ?";
        let result = await this.nwDatabase.query(SQL, [this.apiKey])

        if(result.length == 0)
            return null;

        // Append the build team servers to the result
        SQL = "SELECT IP, ShortName as Name FROM BuildTeamServers WHERE BuildTeam = ?";
        let servers = await this.nwDatabase.query(SQL, this.buildTeamID);

        if(servers.length > 0)
            result[0].Servers = servers;

        return result;
    }



    /* =================================================== */
    /*                DATABASE POST REQUEST                */
    /* =================================================== */

    async createPSPlotInDatabase(city_project_id: number, difficulty_id: number, mc_coordinates: [number, number, number], outline: any, create_player: string, version: string){
        const SQL = "INSERT INTO plotsystem_plots (city_project_id, difficulty_id, mc_coordinates, outline, create_player, version) VALUES (?, ?, ?, ?, ?, ?)";

        const result = await this.psDatabase.query(SQL, [city_project_id, difficulty_id, mc_coordinates, outline, create_player, version]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }   

    async createWarpInDatabase(ID: string, buildTeamID: string, name: string, countryCode: string, subRegion: string, city: string, worldName: string, lat: number, lon: number, height: number, yaw: number, pitch: number, isHighlight: boolean) {
        const SQL = "INSERT INTO BuildTeamWarps (ID, BuildTeam, Name, CountryCode, SubRegion, City, WorldName, Latitude, Longitude, Height, Yaw, Pitch, IsHighlight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        const result = await this.nwDatabase.query(SQL, [ID, buildTeamID, name, countryCode, subRegion, city, worldName, lat, lon, height, yaw, pitch, isHighlight]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    /* =================================================== */
    /*                DATABASE PUT REQUEST                 */
    /* =================================================== */

    // Updates the plot with the given plot id. If one of the parameters is null, the value in the database is not updated.
    async updatePSPlotInDatabase(plot_id: number, city_project_id: number, difficulty_id: number, review_id: number, owner_uuid: string, member_uuids: string[], status: any, mc_coordinates: [number, number, number], outline: any, score: string, last_activity: string, pasted: string, type: string, version: string){
        const SQL = "UPDATE plotsystem_plots SET city_project_id = ?, difficulty_id = ?, review_id = ?, owner_uuid = ?, member_uuids = ?, status = ?, mc_coordinates = ?, outline = ?, score = ?, last_activity = ?, pasted = ?, type = ?, version = ? WHERE id = ?";

        const result = await this.psDatabase.query(SQL, [city_project_id, difficulty_id, review_id, owner_uuid, member_uuids, status, mc_coordinates, outline, score, last_activity, pasted, type, version, plot_id]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    // Updates an existing warp in the database
    async updateWarpInDatabase(ID: string, buildTeamID: string, name: string, countryCode: string, subRegion: string, city: string, worldName: string, lat: number, lon: number, height: number, yaw: number, pitch: number, isHighlight: boolean) {
        const SQL = "UPDATE BuildTeamWarps SET ID = ?, BuildTeam = ?, Name = ?, CountryCode = ?, SubRegion = ?, City = ?, WorldName = ?, Latitude = ?, Longitude = ?, Height = ?, Yaw = ?, Pitch = ?, IsHighlight = ? WHERE ID = ? AND BuildTeam = ?";

        const result = await this.nwDatabase.query(SQL, [ID, buildTeamID, name, countryCode, subRegion, city, worldName, lat, lon, height, yaw, pitch, isHighlight, ID, buildTeamID]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }


    /* =================================================== */
    /*                DATABASE DELETE REQUEST              */
    /* =================================================== */

    // Deletes a warp from the database
    async deleteWarpInDatabase(key: string) {
        const SQL = "DELETE FROM BuildTeamWarps WHERE (Name = ? OR ID = ?) AND BuildTeam = ?";

        const result = await this.nwDatabase.query(SQL, [key, key, this.buildTeamID]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }
}