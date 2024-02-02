import BuildTeam from "./buildteam.js";
import PlotSystem from "./plotsystem.js";
import DatabaseHandler from "../database.js";
import ProgressBar from "progress";
import express from "express";
import joi from "joi";
import fs from 'fs/promises';
import path from 'path';

export enum BuildTeamIdentifier {
    APIKey = "APIKey",
    ID = "ID",
    Tag = "Tag",
    Server = "Server"
}

export enum AddressType {
    BUILDING = "BUILDING",
    STREET = "STREET",
    CITY = "CITY",
    STATE = "STATE",
    COUNTRY = "COUNTRY",
    CUSTOM = "CUSTOM"
}

export default class Network {
    private static readonly API_KEY_UPDATE_INTERVAL: number = 10; // 10 minutes

    private static readonly BUILD_TEAM_INFO_UPDATE_INTERVAL: number = 60 * 1; // 1 hour
    private static readonly BUILD_TEAM_REGIONS_UPDATE_INTERVAL: number = 60 * 1; // 1 hour
    private static readonly BUILD_TEAM_SERVERS_UPDATE_INTERVAL: number = 60 * 1; // 1 hour
    private static readonly BUILD_TEAM_WARPS_UPDATE_INTERVAL: number = 60 * 1; // 1 hour
    private static readonly BUILD_TEAM_WARP_GROUPS_UPDATE_INTERVAL: number = 60 * 1; // 1 hour

    private plotsystemDatabase: DatabaseHandler;
    private networkDatabase: DatabaseHandler;

    private apiKeys: any[] | null = null;
    private buildTeams = new Map<string, BuildTeam>();
    private plotSystem: PlotSystem;

    private apiKeyBuildTeamIDMap = new Map();
    private apiKeyBuildTeamTagMap = new Map();
    private apiKeyBuildTeamServerMap = new Map();

    public buildTeamInfo: any | null = null;
    public buildTeamRegions: any | null = null;
    public buildTeamServers: any | null = null;
    public buildTeamWarps: any | null = null;
    public buildTeamWarpGroups: any | null = null;

    private updateCacheTicks: number = 0;

    constructor(plotsystemDatabase: DatabaseHandler, networkDatabase: DatabaseHandler) {
        this.plotsystemDatabase = plotsystemDatabase;
        this.networkDatabase = networkDatabase;

        this.plotSystem = new PlotSystem(this);
    }

    async updateCache(isStarting: boolean = false) {

        if(this.apiKeys == null || this.updateCacheTicks % Network.API_KEY_UPDATE_INTERVAL == 0){
            this.apiKeys = await this.getAPIKeysFromDatabase();
            this.apiKeyBuildTeamIDMap.clear();
            this.apiKeyBuildTeamTagMap.clear();
            this.apiKeyBuildTeamServerMap.clear();
        }

        let bar:ProgressBar|null = null;
        if (isStarting == true) {
            // Get how many API keys there are as an integer
            var len = (this?.apiKeys?.length ?? 0) + 1;

            // A process bar that shows the progress of the cache update
            bar = new ProgressBar("Starting NetworkAPI [:bar] :percent :etas", {
            complete: "=",
            incomplete: " ",
            width: 20,
            total: len,
            });
            bar.render();
        }

        if (isStarting == true) bar?.tick();


        // Update the cache for all modules

        if(this.buildTeamInfo != null && this.getUpdateCacheTicks() % Network.BUILD_TEAM_INFO_UPDATE_INTERVAL == 0)
            this.buildTeamInfo = null;

        if(this.buildTeamRegions != null && this.getUpdateCacheTicks() % Network.BUILD_TEAM_REGIONS_UPDATE_INTERVAL == 0)
            this.buildTeamRegions = null;

        if(this.buildTeamServers != null && this.getUpdateCacheTicks() % Network.BUILD_TEAM_SERVERS_UPDATE_INTERVAL == 0)
            this.buildTeamServers = null;
            
        if(this.buildTeamWarps != null && this.getUpdateCacheTicks() % Network.BUILD_TEAM_WARPS_UPDATE_INTERVAL == 0)
            this.buildTeamWarps = null;

        if(this.buildTeamWarpGroups != null && this.getUpdateCacheTicks() % Network.BUILD_TEAM_WARP_GROUPS_UPDATE_INTERVAL == 0)
            this.buildTeamWarpGroups = null;


        this.plotSystem.updateCache();

        for (const apiKey of this?.apiKeys?.values() ?? []) {
            const buildTeam = await this.getBuildTeam(apiKey, BuildTeamIdentifier.APIKey);

            if (buildTeam == null) continue;

            await buildTeam.updateCache();

            if (isStarting == true) bar?.tick();
        }

        this.updateCacheTicks++;

        if(this.updateCacheTicks >= Number.MAX_SAFE_INTEGER - 100)
            this.updateCacheTicks = 0;
    }

    async resetCache() {
        this.buildTeams.clear();
        this.plotSystem.resetCache();

        this.apiKeys = null;
        this.apiKeyBuildTeamIDMap.clear();
        this.apiKeyBuildTeamTagMap.clear();
        this.apiKeyBuildTeamServerMap.clear();

        this.buildTeamInfo = null;
        this.buildTeamRegions = null;
        this.buildTeamServers = null;
        this.buildTeamWarps = null;
        this.buildTeamWarpGroups = null;

        this.updateCacheTicks = 0;

        await this.updateCache();

        return true;
    }

 
    getUpdateCacheTicks(): number {
        return this.updateCacheTicks;
    }

    async getAPIKeyByBuildTeamID(buildTeamID: string): Promise<string|null> {
        if(this.apiKeyBuildTeamIDMap.has(buildTeamID))
            return this.apiKeyBuildTeamIDMap.get(buildTeamID);

        const result = await this.getAPIKeyByBuildTeamIDFromDatabase(buildTeamID);

        if(result == null || result.length == 0)
            return null;

        const apiKey = result[0];

        this.apiKeyBuildTeamIDMap.set(buildTeamID, apiKey);
        return apiKey;
    }

    async getAPIKeyByBuildTeamTag(buildTeamTag: string): Promise<string|null> {
        if(this.apiKeyBuildTeamTagMap.has(buildTeamTag))
            return this.apiKeyBuildTeamTagMap.get(buildTeamTag);
        
        const result = await this.getAPIKeyByBuildTeamTagFromDatabase(buildTeamTag);

        if(result == null || result.length == 0)
            return null;
    
        const apiKey = result[0];

        this.apiKeyBuildTeamTagMap.set(buildTeamTag, apiKey);
        return apiKey;
    }

    async getAPIKeyByBuildTeamServer(buildTeamServer: string): Promise<string|null> {
        if(this.apiKeyBuildTeamServerMap.has(buildTeamServer))
            return this.apiKeyBuildTeamServerMap.get(buildTeamServer);

            const result = await this.getAPIKeyByBuildTeamServerFromDatabase(buildTeamServer);

            if(result == null || result.length == 0)
                return null;
        
            const apiKey = result[0];

        this.apiKeyBuildTeamServerMap.set(buildTeamServer, apiKey);
        return apiKey;
    }


    async getAPIKeys(): Promise<string[]> {
        if (this.apiKeys == null) {
            await this.updateCache();
            return [];
        }

        return this.apiKeys;
    }

    getPlotSystem(): PlotSystem {
        return this.plotSystem;
    }

    getNetworkDatabase(): DatabaseHandler {
        return this.networkDatabase;
    }

    getPlotSystemDatabase(): DatabaseHandler {
        return this.plotsystemDatabase;
    }

    getStats(): any {
        return {
            time: new Date().getTime(),
            runningFor: process.uptime(),
            memoryUsage: process.memoryUsage(),
            updateCacheTicks: this.updateCacheTicks,
            apiKeysCount: this.apiKeys == null ? 0 : this.apiKeys.length,
            buildTeamCount: this.buildTeams.size,
            sqlQueryCount: this.networkDatabase.getSQLQueryCount(),
        };
    }

    async getBuildTeam(key: string, identifier: BuildTeamIdentifier): Promise<BuildTeam|null|undefined> {
        const api_keys = await this.getAPIKeys();

        let apiKey = null;

        if(identifier == BuildTeamIdentifier.APIKey)
            apiKey = key;
        else if(identifier == BuildTeamIdentifier.ID)
            apiKey = await this.getAPIKeyByBuildTeamID(key);
        else if(identifier == BuildTeamIdentifier.Tag)
            apiKey = await this.getAPIKeyByBuildTeamTag(key);
        else if(identifier == BuildTeamIdentifier.Server)
            apiKey = await this.getAPIKeyByBuildTeamServer(key);

        if(apiKey == null)
            return null;

        // Validate that the API key exists in the network database
        if (!api_keys.includes(apiKey)) return null;

        // Check if the build team is already in the cache
        if (this.buildTeams.has(apiKey)) return this.buildTeams.get(apiKey);

        // Create a new build team and add it to the cache
        const buildTeam = new BuildTeam(apiKey, this);
        this.buildTeams.set(apiKey, buildTeam);

        return buildTeam;
    }

    async loadBuildTeamInfo() {
        if(this.buildTeamInfo != null)
            return;

        this.buildTeamInfo = await this.getBuildTeamInfoFromDatabase();

        if(this.buildTeamInfo.length == 0){
            console.log("No Build Teams found in the database. Please add at least one Build Team to it.");
            return;
        }
    }

    async loadBuildTeamRegions() {
        if(this.buildTeamRegions != null)
            return;

        this.buildTeamRegions = await this.getBuildTeamRegions();

        if(this.buildTeamRegions.length == 0){
            console.log("No Build Team Regions found in the database. Please add at least one Build Team Region to it.");
            return;
        }
    }

    async loadBuildTeamServers() {
        if(this.buildTeamServers != null)
            return;

        this.buildTeamServers = await this.getBuildTeamServersFromDatabase();

        if(this.buildTeamServers.length == 0){
            console.log("No Build Team Servers found in the database. Please add at least one Build Team Server to it.");
            return;
        }
    }

    async loadBuildTeamWarps() {
        if(this.buildTeamWarps != null)
            return;

        this.buildTeamWarps = await this.getWarpsFromDatabase();

        if(this.buildTeamWarps.length == 0){
            console.log("No Build Team Warps found in the database. Please add at least one Build Team Warp to it.");
            return;
        }
    }

    async loadBuildTeamWarpGroups() {
        if(this.buildTeamWarpGroups != null)
            return;

        this.buildTeamWarpGroups = await this.getWarpGroupsFromDatabase();

        if(this.buildTeamWarpGroups.length == 0){
            console.log("No Build Team Warp Groups found in the database. Please add at least one Build Team Warp Group to it.");
            return;
        }
    }


    /** Returns a list with information about all BuildTeams */
    async getBuildTeamInfo(){
        if(this.buildTeams == null)
            return null;

        let buildTeamInfoList = [];

        const teams: Iterable<BuildTeam> = this.buildTeams.values();
        for (const buildTeam of teams) 
            buildTeamInfoList.push(await buildTeam.getBuildTeamInfo(null));

        return buildTeamInfoList;
    }

    /** Returns a list with information about the countries of all Build Teams that work on countries. 
     * Build Teams with other RegionTypes like CITY or STATE are not included. 
     * If no countries are found, an empty list is returned.*/
    async getBuildTeamCountries(){
        if(this.buildTeamRegions == null)
            this.getBuildTeamRegions();

        if(this.buildTeamRegions == null)
            return null;

        let buildTeamRegionsCopy = JSON.parse(JSON.stringify(this.buildTeamRegions));

        // Remove all regions that are not countries
        buildTeamRegionsCopy = buildTeamRegionsCopy.filter((region: { RegionType: string; }) => region.RegionType == "COUNTRY");
        
        return buildTeamRegionsCopy;
    }

    async getBuildTeamRegions(){
        if(this.buildTeamRegions == null)
            this.buildTeamRegions = await this.getBuildTeamRegionsFromDatabase();

        if(this.buildTeamRegions == null)
            return null;

        // Read the countries.json file
        const filePath = path.join(process.cwd(), 'lib', 'countries.json');
        const rawData = await fs.readFile(filePath, 'utf-8');
        const countriesData = JSON.parse(rawData);

        let buildTeamRegionsCopy = JSON.parse(JSON.stringify(this.buildTeamRegions));


        for (const region of buildTeamRegionsCopy) 
        for (const countryData of countriesData) 
            if(region.RegionType == "COUNTRY" && countryData.cca3 == region.RegionCode){

                // Add the parameters "cca2", "ccn3", "cioc", "region", "subregion", "capital", "languages", "latlng", "area", "borders" to the countryTeamsListCopy
                region.cca2 = countryData.cca2;
                region.ccn3 = countryData.ccn3;
                region.cioc = countryData.cioc;
                region.region = countryData.region;
                region.subregion = countryData.subregion;
                region.capital = countryData.capital;
                region.languages = countryData.languages;
                region.latlng = countryData.latlng;
                region.area = countryData.area;
                region.borders = countryData.borders;

                break;
            }
        
        return buildTeamRegionsCopy;
    }

    async getBuildTeamWarps(){
        if(this.buildTeamWarps == null)
            await this.loadBuildTeamWarps();

        if(this.buildTeamWarps == null)
            return null;

        return this.buildTeamWarps;
    }

    async getBuildTeamWarpGroups(){
        if(this.buildTeamWarpGroups == null)
            await this.loadBuildTeamWarpGroups();

        if(this.buildTeamWarpGroups == null)
            return null;

        return this.buildTeamWarpGroups;
    }

    async getAddressFromCoordinates(lat: number, lon: number, addressType: AddressType): Promise<string>{
        if(addressType == null || addressType == AddressType.CUSTOM)
            return "Unknown";

        // Convert the addressType to a zoom level
        let zoomLevel = 10;

        if(addressType == AddressType.BUILDING)
            zoomLevel = 19;
        else if(addressType == AddressType.STREET)
            zoomLevel = 17;
        else if(addressType == AddressType.CITY)
            zoomLevel = 10;
        else if(addressType == AddressType.STATE)
            zoomLevel = 5;
        else if(addressType == AddressType.COUNTRY)
            zoomLevel = 3;
        else if(addressType == AddressType.CUSTOM)
            return "Unknown";

        // Get the address from the OpenStreetMap API
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=${zoomLevel}`;

        const response = await fetch(url);
        const json = await response.json();

        // Return the address
        return json.display_name;
    }




    



    // Validate values

    // Validate an API key that looks like this "fffb262b-0324-499a-94a6-eebf845e6123"
    async validateAPIKey(req: express.Request, res: express.Response): Promise<boolean> {
        // Validate that the API key is a valid GUID
        const schema = joi.object().keys({
            apikey: joi.string().guid().required(),
        });

        const result = schema.validate(req.params);
        if (result.error) {
            res.status(400).send(result.error.details[0].message);
            return false;
        }

        //Validate that the API key exists in the plot system database
        const api_keys = await this.getAPIKeys();

        if (!api_keys.includes(req.params.apikey)) {
            res.status(401).send({ success: false, error: "Invalid API key" });
            return false;
        }

        return true;
    }

     // Validate an API key and an Order ID that look like this "fffb262b-0324-499a-94a6-eebf845e6123"
     async validateAPIKeyAndOrderID(req: express.Request, res: express.Response): Promise<boolean> {
        // Validate that the API key and the oOder ID is a valid GUID
        const schema = joi.object().keys({
            apikey: joi.string().guid().required(),
            orderId: joi.string().guid().required(),
        });

        const result = schema.validate(req.params);
        if (result.error) {
            res.status(400).send(result.error.details[0].message);
            return false;
        }

        //Validate that the API key exists in the plot system database
        const api_keys = await this.getAPIKeys();

        if (!api_keys.includes(req.params.apikey)) {
            res.status(401).send({ success: false, error: "Invalid API key" });
            return false;
        }

        return true;
    }

    // Validate a key that is either an API Key or a Build Team ID or a Build Team Tag or a BuildTeam Server ID
    async validateKey(req: express.Request, res: express.Response): Promise<BuildTeamIdentifier|null> {
        const apiKeys = await this.getAPIKeys();

        // Check if key is an API Key
        if(apiKeys.includes(req.params.key))
            return BuildTeamIdentifier.APIKey;

        // Check if key is a Build Team ID
        const APIKeyByBuildTeamID = await this.getAPIKeyByBuildTeamID(req.params.key);
        if(APIKeyByBuildTeamID != null && apiKeys.includes(APIKeyByBuildTeamID))
            return BuildTeamIdentifier.ID;

        // Check if key is a Build Team Tag
        const APIKeyByBuildTeamTag = await this.getAPIKeyByBuildTeamTag(req.params.key);
        if(APIKeyByBuildTeamTag != null && apiKeys.includes(APIKeyByBuildTeamTag))
            return BuildTeamIdentifier.Tag;

        // Check if key is a BungeeCord Server ID
        const APIKeyByBuildTeamServer = await this.getAPIKeyByBuildTeamServer(req.params.key);
        if(APIKeyByBuildTeamServer != null && apiKeys.includes(APIKeyByBuildTeamServer))
            return BuildTeamIdentifier.Server;


        res.status(401).send({ success: false, error: "Invalid API Key, Build Team ID, Build Team Tag or Build Team Server ID" });
        return null;   
    }





    /* =================================================== */
    /*              DATABASE GET REQUESTS                  */
    /* =================================================== */

    private async getAPIKeysFromDatabase() : Promise<string[]> {
        const SQL = "SELECT APIKey FROM BuildTeams WHERE Visibility != 'Private'";
        const result = await this.networkDatabase.query(SQL); // result: [{"APIKey":"super_cool_api_key"}]
        return result.map((row: { APIKey: string }) => row.APIKey); // result: ["super_cool_api_key"]
    }

    private async getAPIKeyByBuildTeamIDFromDatabase(buildTeamID: string) : Promise<string[]> {
        const SQL = "SELECT APIKey FROM BuildTeams WHERE ID = ?";
        const result = await this.networkDatabase.query(SQL, [buildTeamID]); // result: [{"APIKey":"super_cool_api_key"}]
        return result.map((row: { APIKey: string }) => row.APIKey); // result: ["super_cool_api_key"]
    }

    private async getAPIKeyByBuildTeamTagFromDatabase(buildTeamTag: string) : Promise<string[]> {
        const SQL = "SELECT APIKey FROM BuildTeams WHERE Tag = ?";
        const result = await this.networkDatabase.query(SQL, [buildTeamTag]); // result: [{"APIKey":"super_cool_api_key"}]
        return result.map((row: { APIKey: string }) => row.APIKey); // result: ["super_cool_api_key"]
    }

    private async getAPIKeyByBuildTeamServerFromDatabase(buildTeamTag: string) : Promise<string[]> {
        const SQL = "SELECT APIKey FROM BuildTeams, BuildTeamServers WHERE BuildTeams.ID = BuildTeamServers.BuildTeam AND BuildTeamServers.ShortName = ?";
        const result = await this.networkDatabase.query(SQL, [buildTeamTag]); // result: [{"APIKey":"super_cool_api_key"}]
        return result.map((row: { APIKey: string }) => row.APIKey); // result: ["super_cool_api_key"]
    }

    private async getBuildTeamRegionsFromDatabase() {
        const SQL = "SELECT * FROM `BuildTeamRegions`";
        return await this.networkDatabase.query(SQL); // result: [{"RegionCode":"ABW","BuildTeam":"m3pKPALP","RegionName":"Aruba"}]
    }

    private async getBuildTeamInfoFromDatabase() {
        const SQL = "SELECT * FROM BuildTeams WHERE Visibility != 'Private'";
        return await this.networkDatabase.query(SQL);
    }

    private async getBuildTeamServersFromDatabase() {
        const SQL = "SELECT * FROM BuildTeamServers";
        return await this.networkDatabase.query(SQL);
    }

    private async getWarpsFromDatabase(){
        const SQL = "SELECT * FROM BuildTeamWarps";
        return await this.networkDatabase.query(SQL);
    }

    private async getWarpGroupsFromDatabase(){
        const SQL = "SELECT * FROM BuildTeamWarpGroups";
        return await this.networkDatabase.query(SQL);
    }
}
