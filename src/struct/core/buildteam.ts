import DatabaseHandler from "../database.js";
import Network, { AddressType } from "./network.js";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

interface Plot {
    id: number,
    city_project_id: number,
    difficulty_id: number,
    review_id: number,
    owner_uuid: string,
    member_uuids: string[],
    status: any,
    mc_coordinates: [number, number, number],
    outline: any,
    score: string,
    last_activity: string,
    pasted: string,
    type: string,
    version: string,
    create_player: string
}

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

    private psBuildTeamID: string | null = null;
    private psCities: Map<number, any[]> = new Map() // Map<country_id, city>
    private psCountries: Map<number, any[]> = new Map() // Map<country_id, country>
    private psServers: Map<number, any[]> = new Map() // Map<server_id, server>
    private psFTPConfiguration: Map<number, any[]> = new Map(); // Map<server_id, ftp_configuration>
    private psTmpPlots: Map<string, {}> = new Map(); // Map<order_id, plot>

    private buildTeamInfo: any | null = null;


    constructor(apiKey: string, network: Network) {
        this.apiKey = apiKey;
        this.network = network;
        this.psDatabase = network.getPlotSystemDatabase();
        this.nwDatabase = network.getNetworkDatabase();
    }

    async getBuildTeamID(){
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();

        return this.buildTeamID;
    }

    // Updates the cache for the build team
    async updateCache(){
        if(this.psDatabase.settings.debug)
            console.log("Emptying the cache for build team: " + this.apiKey)

        if(this.buildTeamInfo != null && this.network.getUpdateCacheTicks() % BuildTeam.BUILD_TEAM_INFO_UPDATE_INTERVAL == 0)
            this.buildTeamInfo = null;

        if(this.psCities != null && this.network.getUpdateCacheTicks() % BuildTeam.CITY_UPDATE_INTERVAL == 0)
            this.psCities.clear();

        if(this.psCountries != null && this.network.getUpdateCacheTicks() % BuildTeam.COUNTRY_UPDATE_INTERVAL == 0)
            this.psCountries.clear();
            
        if(this.psServers != null && this.network.getUpdateCacheTicks() % BuildTeam.SERVER_UPDATE_INTERVAL == 0)
            this.psServers.clear();

        if(this.psFTPConfiguration != null && this.network.getUpdateCacheTicks() % BuildTeam.FTP_CONFIGURATION_UPDATE_INTERVAL == 0)
            this.psFTPConfiguration.clear();
    }

    // Resets the cache for the build team
    async resetCache(){
        this.buildTeamInfo = null;
        this.psCities.clear();
        this.psCountries.clear();
        this.psServers.clear();
        this.psFTPConfiguration.clear();
    }

    async loadBuildTeamData(){
        if(this.psDatabase.settings.debug)
            console.log("Loading data for build team: " + this.apiKey)

        // Get the build team information
        this.buildTeamID = await this.getBuildTeamIDFromDatabase();
        this.psBuildTeamID = await this.getPSBuildTeamIDFromDatabase();
        this.buildTeamInfo = await this.loadBuildTeamInfo();

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

    async loadBuildTeamInfo(){
        if(this.network.buildTeamInfo == null)
            await this.network.loadBuildTeamInfo();
        if(this.network.buildTeamRegions == null)
            await this.network.loadBuildTeamRegions();
        if(this.network.buildTeamServers == null)
            await this.network.loadBuildTeamServers();
        if(this.network.buildTeamWarps == null)
            await this.network.loadBuildTeamWarps();
        if(this.network.buildTeamWarpGroups == null)
            await this.network.loadBuildTeamWarpGroups();

        // Validate that all data is loaded
        if(this.apiKey == null){
            console.log("API Key is not set in loadBuildTeamInfo() for Team: " + this.buildTeamID)
            return null;
        }
        if(this.network.buildTeamInfo == null){
            console.log("Build Team Info could not be loaded in loadBuildTeamInfo().")
            return null;
        }
        if(this.network.buildTeamRegions == null){
            console.log("Build Team Regions could not be loaded in loadBuildTeamInfo().")
            return null;
        }
        if(this.network.buildTeamServers == null){
            console.log("Build Team Servers could not be loaded in loadBuildTeamInfo().")
            return null;
        }
        if(this.network.buildTeamWarps == null){
            console.log("Build Team Warps could not be loaded in loadBuildTeamInfo().")
            return null;
        }
        if(this.network.buildTeamWarpGroups == null){
            console.log("Build Team Warp Groups could not be loaded in loadBuildTeamInfo().")
            return null;
        }


        // BuildTeamInfo is a json array with one object per buildteam
        let info = this.network.buildTeamInfo.filter((info: any) => info.APIKey == this.apiKey)[0];

        // Make a copy of the object
        info = JSON.parse(JSON.stringify(info));

        if(info == null){
            console.log("Build Team Info could not be found by API Key in loadBuildTeamInfo().")     
            return null;
        }

        // Remove the APIKey from the object
        info.APIKey = undefined;

        // Check if the build team is connected to the network or not
        // If not, get the IP of the main server and switch the servers array to only contain the main server IP
        let servers = null;
        if(info.Visibility == "OtherServer" && info.Description != null && info.Description.includes("Current IP:\\n")){
            const server_IP = info.Description.split("Current IP:\\n")[1].split("\\n")[0];

            if(server_IP != null){
                info.MainServerIP = server_IP;
                servers = [{"IP" : server_IP}]
            }

            info.isConnectedToNetwork = false;
        }else{
            info.isConnectedToNetwork = true;
        }

        // Add servers to the build team info

        if(servers == null)
            info.Servers = JSON.parse(JSON.stringify(this.network.buildTeamServers)).filter((server: any) => server.BuildTeam == info.ID);
        else
            info.Servers = servers;

        for(const server of info.Servers)
            server.BuildTeam = undefined;

        // Add regions to the build team info

        info.Regions = JSON.parse(JSON.stringify(this.network.buildTeamRegions)).filter((region: any) => region.BuildTeam == info.ID);

        for(const region of info.Regions)
            region.BuildTeam = undefined;


        // Add warps to the build team info

        info.Warps = JSON.parse(JSON.stringify(this.network.buildTeamWarps)).filter((warp: any) => warp.BuildTeam == info.ID);

        for(const warp of info.Warps)
            warp.BuildTeam = undefined;


        // Add warp groups to the build team info

        info.WarpGroups = JSON.parse(JSON.stringify(this.network.buildTeamWarpGroups)).filter((warpGroup: any) => warpGroup.BuildTeam == info.ID);

        for(const warpGroup of info.WarpGroups)
            warpGroup.BuildTeam = undefined;
        
        
        // Set the build team info
        this.buildTeamInfo = info;

        return info;
    }

    /** Returns information about the build team. 
        If key is null, all information is returned, otherwise only the information for the given key is returned. 
        If no information is found, null is returned.*/
    async getBuildTeamInfo(key: string | null){
        if(this.buildTeamInfo == null)
            await this.loadBuildTeamInfo();

        if(this.buildTeamInfo == null){
            console.log("Build Team Info could not be loaded in getBuildTeamInfo().")
            return null;
        }
            
        if(key == null)
            return this.buildTeamInfo;

        if(!this.buildTeamInfo.hasOwnProperty(key)){
            console.log("Build Team Info key could not be found in getBuildTeamInfo(). Key: " + key)
            return null;
        }

        return this.buildTeamInfo[key];
    }

    /** Updates the variable hasBuildTeamToolsInstalled for the Build Team */
    async setHasBuildTeamToolsInstalled(hasBuildTeamToolsInstalled: boolean) : Promise<any>{
        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();
        if(this.buildTeamID == null)
            return Promise<"Build Team ID could not be loaded">;

        return await this.updateHasBuildTeamToolsInstalledInDatabase(hasBuildTeamToolsInstalled);
    }


    /* ======================================= */
    /*                  Warps                  */
    /* ======================================= */


    /** Creates a new warp for the build team.
     * 
     * @param id The ID of the warp
     * @param warpGroupID The id of the warp group
     * @param name The name of the warp
     * @param countryCode Country Code that matches the countryCodeType
     * @param countryCodeType Country Code Type like cca2, cca3, ccn3, or cioc
     * @param address The address of the warp
     * @param addressType The type of address (BUILDING, STREET, CITY, STATE, COUNTRY, CUSTOM)
     * @param material The material of the warp
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
    async createWarp(id: string|null, warpGroupID: string|null, name: string, countryCode: string, countryCodeType: string, address: string|null, addressType: AddressType, material: string, worldName: string, lat: number, lon: number, y: number, yaw: number, pitch: number, isHighlight: boolean) {
        // Generate a new uuid if the id is null
        if(id == null || id == undefined)
            id = uuidv4();        

        // Get the address of the warp if it is null. If the address is not null, change the address type to CUSTOM
        if(address == null || address == undefined)
            address = await this.network.getAddressFromCoordinates(lat, lon, addressType);
        else
            addressType = AddressType.CUSTOM;

        // If warpGroupID is undefined, set it to null
        if(warpGroupID == undefined)
            warpGroupID = null;

        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();
        if(this.buildTeamID == null){
            console.log("Build Team ID could not be loaded in createWarp().")
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

        const success = await this.createWarpInDatabase(id, this.buildTeamID, warpGroupID, name, finalCountryCode, address, addressType, material, worldName, lat, lon, y, yaw, pitch, isHighlight);
        
        // Reset the cache to make sure the new warp is loaded
        this.network.buildTeamWarps = null;
        this.resetCache();

        return success;
    }


    /** Updates an existing warp of the build team.
     * 
     * @param ID The new ID of the warp
     * @param warpGroupID The new id of the warp group
     * @param name The new name of the warp
     * @param countryCode The new Country Code that matches the countryCodeType
     * @param countryCodeType Country Code Type like cca2, cca3, ccn3, or cioc
     * @param address The new address of the warp
     * @param worldName The name of the world the warp is in
     * @param lat The new latitude of the warp
     * @param lon The new longitude of the warp
     * @param y The new y coordinate of the warp
     * @param yaw The new yaw of the warp
     * @param pitch The new pitch of the warp
     * @param isHighlight Whether the warp is a highlight or not
     * 
     * @returns Returns true if the warp was created successfully, otherwise false.
     **/
    async updateWarp(ID: string, warpGroupID: string, name: string, countryCode: string, countryCodeType: string, address: string, addressType: AddressType, material: string, worldName: string, lat: number, lon: number, y: number, yaw: number, pitch: number, isHighlight: boolean) {
        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();
        if(this.buildTeamID == null)
            return false;

        // If the warp was not found, return an error
        if(!await this.warpExists(ID))
            return false;

        // Get the address of the warp if it is null
        if(address == null || address == undefined)
            address = await this.network.getAddressFromCoordinates(lat, lon, addressType);


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

        const success = await this.updateWarpInDatabase(ID, this.buildTeamID, warpGroupID, name, finalCountryCode, address, addressType, material, worldName, lat, lon, y, yaw, pitch, isHighlight);
    
        // Reset the cache to make sure the warp is reloaded
        this.network.buildTeamWarps = null;
        this.resetCache();

        return success;
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

        const success = await this.deleteWarpInDatabase(key);

        // Reset the cache to make sure the warp is deleted
        this.network.buildTeamWarps = null;
        this.resetCache();

        return success;
    }

    /** Returns a list of warps based on the build team id. If no warps are found, an empty list is returned.*/
    async getWarps(){
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();

        if(this.buildTeamID == null)
            return [];
    
        const result = await this.network.getBuildTeamWarps();

        if(result == null)
            return [];

        return result.filter((warp: any) => warp.BuildTeam == this.buildTeamID);
    }

    /** Checks if a warp exists.
     * 
     * @param warpID The ID of the warp
     * 
     * @returns Returns true if the warp exists, otherwise false.
     */
    async warpExists(warpID: string){
        const warps = await this.getWarps();
        return warps.some((warp: any) => warp.ID == warpID);
    }



    /* ======================================= */
    /*              Warp Groups                */
    /* ======================================= */



    /** Creates a new warp group for the build team.
     * 
     * @param id The ID of the warp group
     * @param name The name of the warp group
     * @param description The description of the warp group
     * 
     * @returns Returns true if the warp group was created successfully, otherwise false.
     **/
    async createWarpGroup(id: string|null, name: string, description: string) {
        // Generate a new uuid if the id is null
        if(id == null)
            id = uuidv4();        

        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();
        if(this.buildTeamID == null)
            return false;
        
        const success = await this.createWarpGroupInDatabase(id, name, description);

        // Reset the cache to make sure the new warp group is loaded
        this.network.buildTeamWarpGroups = null;
        this.resetCache();

        return success;
    }


    /** Updates an existing warp group of the build team.
     *  
     * @param id The new ID of the warp group
     * @param name The new name of the warp group
     * @param description The new description of the warp group
     * 
     * @returns Returns true if the warp was created successfully, otherwise false.
     **/
    async updateWarpGroup(id: string, name: string, description: string) {
        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();
        if(this.buildTeamID == null)
            return false;

        // If the warp was not found, return an error
        if(!await this.warpGroupExists(id))
            return false;

        const success = await this.updateWarpGroupInDatabase(id, name, description);

        // Reset the cache to make sure the warp group is reloaded
        this.network.buildTeamWarpGroups = null;
        this.resetCache();

        return success;
    }


    /** Deletes a warp group from the build team.
     * 
     * @param key The name or ID of the warp group
     */
    async deleteWarpGroup(key: string) {
        // Validate that the build team id is loaded
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();

        if(this.buildTeamID == null)
            return false;

        const success = await this.deleteWarpGroupInDatabase(key);

        // Reset the cache to make sure the warp group is deleted
        this.network.buildTeamWarpGroups = null;
        this.resetCache();

        return success;
    }

    /** Returns a list of warp groups based on the build team id. If no warp groups are found, an empty list is returned.*/
    async getWarpGroups(){
        if(this.buildTeamID == null)
            await this.loadBuildTeamData();

        if(this.buildTeamID == null)
            return [];
    
        const result = await this.network.getBuildTeamWarpGroups();

        if(result == null)
            return [];

        return result.filter((warp: any) => warp.BuildTeam == this.buildTeamID);
    }

    /** Checks if a warp group exists.
     * 
     * @param warpGroupID The ID of the warp group
     * 
     * @returns Returns true if the warp group exists, otherwise false.
     */
    async warpGroupExists(warpGroupID: string){
        const warpgroups = await this.getWarpGroups();
        return warpgroups.some((warp: any) => warp.ID == warpGroupID);
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

        const ftpConfigJSON: any = {};

        for(const [server_id, ftp_config] of this.psFTPConfiguration.entries())
            ftpConfigJSON[server_id] = ftp_config;

        return ftpConfigJSON;        
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

    /** Creates a new plot for the given city id. If the city id is not found, false is returned. 
     * 
     * @param is_order Whether the plot needs confirmation or not. If true, the plot is not created and an order id is returned instead.
     * 
     * @returns Returns 0 if success, -2 if the city id is not found, -1 if the plot was not created, otherwise the order id of the plot.
     * */ 
    async createPSPlot(is_order: boolean, city_project_id: number, difficulty_id: number, mc_coordinates: [number, number, number], outline: any, create_player: string, version: string): Promise<string | number>{
        const cities = await this.getPSCities();
        
        if(!cities.some(city => city.id == city_project_id))
            return -2;

        if(!is_order){
            const result = await this.createPSPlotInDatabase(city_project_id, difficulty_id, mc_coordinates, outline, create_player, version);

            if(result == false)
                return -1;
            else
                return result;
        }else{
            const tmpPlot = {
                city_project_id: city_project_id,
                difficulty_id: difficulty_id,
                mc_coordinates: mc_coordinates,
                outline: outline,
                create_player: create_player,
                version: version
            }
            
            // Create random order uuid
            let order_id = uuidv4();

            // Make sure the order id is not already in use
            while(this.psTmpPlots.has(order_id))
                order_id = uuidv4();

            this.psTmpPlots.set(order_id, tmpPlot);  
            
            return order_id;
        }
    }

    async confirmPSOrder(order_id: string): Promise<number | false>{
        if(!this.psTmpPlots.has(order_id))
            return false;

        const tmpPlotJSON: {} | undefined = this.psTmpPlots.get(order_id);

        if (tmpPlotJSON == null)
            return false;

        const tmpPlot: Plot = tmpPlotJSON as Plot;

        const success = await this.createPSPlotInDatabase(tmpPlot.city_project_id, tmpPlot.difficulty_id, tmpPlot.mc_coordinates, tmpPlot.outline, tmpPlot.create_player, tmpPlot.version);

        if(success)
            this.psTmpPlots.delete(order_id);

        return success;
    }

    // Updates the plot with the given plot id. If the plot id is not found, false is returned.
    async updatePSPlot(plot_id: number, city_project_id: number, difficulty_id: number, review_id: number, owner_uuid: string, member_uuids: string[], status: any, mc_coordinates: [number, number, number], outline: any, score: string, last_activity: string, pasted: string, type: string, version: string){
        if(!this.isValidPSPlot(plot_id))
            return false;

        return await this.updatePSPlotInDatabase(plot_id, city_project_id, difficulty_id, review_id, owner_uuid, member_uuids, status, mc_coordinates, outline, score, last_activity, pasted, type, version);
    }

    // Deletes the plot with the given plot id. If the plot id is not found, false is returned.
    async deletePSPlot(plot_id: number){
        if(!this.isValidPSPlot(plot_id))
            return false;

        return await this.deletePSPlotInDatabase(plot_id);
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

    private async getBuildTeamIDFromDatabase(){
        const SQL = "SELECT ID as btid FROM BuildTeams WHERE APIKey = ?";
        const result = await this.nwDatabase.query(SQL, [this.apiKey]);

        if(result.length == 0)
            return null;

        return result[0].btid;
    }

    private async getPSBuildTeamIDFromDatabase(){
        const SQL = "SELECT plotsystem_buildteams.id FROM plotsystem_buildteams, plotsystem_api_keys WHERE plotsystem_api_keys.api_key = ? AND plotsystem_api_keys.id = plotsystem_buildteams.api_key_id";
        const result = await this.psDatabase.query(SQL, [this.apiKey]);

        if(result.length == 0)
            return null;

        return result[0].id;
    }
    
    private async getPSCountriesFromDatabase(){
        const SQL = "SELECT a.* FROM plotsystem_countries as a, plotsystem_buildteam_has_countries as b WHERE buildteam_id = ? AND a.id = b.country_id";
        return await this.psDatabase.query(SQL, [this.psBuildTeamID]);
    }

    private async getPSCitiesFromDatabase(country_id: number){
        const SQL = "SELECT * FROM plotsystem_city_projects WHERE country_id = ?";
        return await this.psDatabase.query(SQL, [country_id]);
    }

    private async getPSServersFromDatabase(country_id: number){
        const SQL = "SELECT * FROM plotsystem_servers WHERE id = (SELECT server_id FROM plotsystem_countries WHERE id = ?)";
        return await this.psDatabase.query(SQL, [country_id]);
    }

    private async getPSFTPConfigurationFromDatabase(server_id: number){
        const SQL = "SELECT * FROM plotsystem_ftp_configurations as a WHERE a.id = (SELECT ftp_configuration_id FROM plotsystem_servers as b WHERE b.id = ?)";
        return await this.psDatabase.query(SQL, [server_id]);
    }

    private async getPSCityPlotsFromDatabase(city_id: number){
        const SQL = "SELECT * FROM plotsystem_plots WHERE city_project_id = ?";
        return await this.psDatabase.query(SQL, [city_id]);
    }

    private async getPSCityReviewsFromDatabase(city_id: number){
        const SQL = "SELECT a.* FROM plotsystem_reviews as a, plotsystem_plots as b WHERE a.id = b.review_id";
        return await this.psDatabase.query(SQL, [city_id]);
    }



    /* =================================================== */
    /*                DATABASE POST REQUEST                */
    /* =================================================== */

    private async createPSPlotInDatabase(city_project_id: number, difficulty_id: number, mc_coordinates: [number, number, number], outline: any, create_player: string, version: string): Promise<number | false>{
        const SQL = "INSERT INTO plotsystem_plots (city_project_id, difficulty_id, mc_coordinates, outline, create_player, version) VALUES (?, ?, ?, ?, ?, ?)";

        const result = await this.psDatabase.query(SQL, [city_project_id, difficulty_id, mc_coordinates, outline, create_player, version]);

        if(result.affectedRows == 1)
            return result.insertId;
        else 
            return false;
    }   

    private async createWarpInDatabase(ID: string, buildTeamID: string, warpGroupID: string|null, name: string, countryCode: string, address: string, addressType: string, material: string, worldName: string, lat: number, lon: number, height: number, yaw: number, pitch: number, isHighlight: boolean) {
        const SQL = "INSERT INTO BuildTeamWarps (ID, BuildTeam, WarpGroup, Name, CountryCode, Address, AddressType, Material, WorldName, Latitude, Longitude, Height, Yaw, Pitch, IsHighlight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        const result = await this.nwDatabase.query(SQL, [ID, buildTeamID, warpGroupID, name, countryCode, address, addressType, material, worldName, lat, lon, height, yaw, pitch, isHighlight]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    private async createWarpGroupInDatabase(id: string, name: string, description: string) {
        const SQL = "INSERT INTO BuildTeamWarpGroups (ID, BuildTeam, Name, Description) VALUES (?, ?, ?, ?)";

        const result = await this.nwDatabase.query(SQL, [id, this.buildTeamID, name, description]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    /* =================================================== */
    /*                DATABASE PUT REQUEST                 */
    /* =================================================== */

    // Updates the plot with the given plot id. If one of the parameters is null, the value in the database is not updated.
    private async updatePSPlotInDatabase(plot_id: number, city_project_id: number, difficulty_id: number, review_id: number, owner_uuid: string, member_uuids: string[], status: any, mc_coordinates: [number, number, number], outline: any, score: string, last_activity: string, pasted: string, type: string, version: string){
        const SQL = "UPDATE plotsystem_plots SET city_project_id = ?, difficulty_id = ?, review_id = ?, owner_uuid = ?, member_uuids = ?, status = ?, mc_coordinates = ?, outline = ?, score = ?, last_activity = ?, pasted = ?, type = ?, version = ? WHERE id = ?";

        const result = await this.psDatabase.query(SQL, [city_project_id, difficulty_id, review_id, owner_uuid, member_uuids, status, mc_coordinates, outline, score, last_activity, pasted, type, version, plot_id]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    // Updates an existing warp in the database
    private async updateWarpInDatabase(ID: string, buildTeamID: string, warpGroupID: string, name: string, countryCode: string, address: string, addressType: string, material: string, worldName: string, lat: number, lon: number, height: number, yaw: number, pitch: number, isHighlight: boolean) {
        const SQL = "UPDATE BuildTeamWarps SET ID = ?, BuildTeam = ?, WarpGroup = ?, Name = ?, CountryCode = ?, Address = ?, AddressType = ?, Material = ?, WorldName = ?, Latitude = ?, Longitude = ?, Height = ?, Yaw = ?, Pitch = ?, IsHighlight = ? WHERE ID = ? AND BuildTeam = ?";

        const result = await this.nwDatabase.query(SQL, [ID, buildTeamID, warpGroupID, name, countryCode, address, addressType, material, worldName, lat, lon, height, yaw, pitch, isHighlight, ID, buildTeamID]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    // Updates an existing warp group in the database
    private async updateWarpGroupInDatabase(id: string, name: string, description: string) {
        const SQL = "UPDATE BuildTeamWarpGroups SET ID = ?, BuildTeam = ?, Name = ?, Description = ? WHERE ID = ? AND BuildTeam = ?";

        const result = await this.nwDatabase.query(SQL, [id, this.buildTeamID, name, description, id, this.buildTeamID]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    private async updateHasBuildTeamToolsInstalledInDatabase(hasBuildTeamToolsInstalled: boolean) : Promise<boolean | string> {
        const SQL = "UPDATE BuildTeams SET hasBuildTeamToolsInstalled = ? WHERE ID = ?";

        const result = await this.nwDatabase.query(SQL, [hasBuildTeamToolsInstalled, this.buildTeamID]);

        if(result.affectedRows == 1)
            return true;
        else 
            return this.buildTeamID + " " + hasBuildTeamToolsInstalled;
    }

    /* =================================================== */
    /*                DATABASE DELETE REQUEST              */
    /* =================================================== */

    // Deletes a warp from the database
    private async deleteWarpInDatabase(key: string) {
        const SQL = "DELETE FROM BuildTeamWarps WHERE (Name = ? OR ID = ?) AND BuildTeam = ?";

        const result = await this.nwDatabase.query(SQL, [key, key, this.buildTeamID]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    // Deletes a warp group from the database
    private async deleteWarpGroupInDatabase(key: string) {
        const SQL = "DELETE FROM BuildTeamWarpGroups WHERE (Name = ? OR ID = ?) AND BuildTeam = ?";

        const result = await this.nwDatabase.query(SQL, [key, key, this.buildTeamID]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }

    // Deletes a plot from the database
    private async deletePSPlotInDatabase(plot_id: number){
        const SQL = "DELETE FROM plotsystem_plots WHERE id = ?";

        const result = await this.psDatabase.query(SQL, [plot_id]);

        if(result.affectedRows == 1)
            return true;
        else 
            return false;
    }
}