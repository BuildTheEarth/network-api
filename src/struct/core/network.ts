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

export default class Network {
    private static readonly API_KEY_UPDATE_INTERVAL: number = 10; // 10 minutes

    private static readonly COUNTRY_TEAMS_LIST_UPDATE_INTERVAL: number = 60 * 1; // 1 hour

    private plotsystemDatabase: DatabaseHandler;
    private networkDatabase: DatabaseHandler;

    private apiKeys: any[] | null = null;
    private buildTeams = new Map();
    private plotSystem: PlotSystem;

    private apiKeyBuildTeamIDMap = new Map();
    private apiKeyBuildTeamTagMap = new Map();
    private apiKeyBuildTeamServerMap = new Map();

    private countryTeamsList: any | null = null;

    private updateCacheTicks: number = 0;

    constructor(plotsystemDatabase: DatabaseHandler, networkDatabase: DatabaseHandler) {
        this.plotsystemDatabase = plotsystemDatabase;
        this.networkDatabase = networkDatabase;

        this.plotSystem = new PlotSystem(this);
    }

    async updateCache(isStarting: boolean = false) {
        this.updateCacheTicks++;

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

        if(this.countryTeamsList != null && this.getUpdateCacheTicks() % Network.COUNTRY_TEAMS_LIST_UPDATE_INTERVAL == 0)
            this.countryTeamsList = null;

        this.plotSystem.updateCache();

        for (const apiKey of this?.apiKeys?.values() ?? []) {
            const buildTeam = await this.getBuildTeam(apiKey, BuildTeamIdentifier.APIKey);

            if (buildTeam == null) continue;

            buildTeam.updateCache();

            if (isStarting == true) bar?.tick();
        }


        if(this.updateCacheTicks >= Number.MAX_SAFE_INTEGER - 100)
            this.updateCacheTicks = 0;
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


    getAPIKeys(): string[] {
        if (this.apiKeys == null) {
            this.updateCache();
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

    async getBuildTeam(key: string, identifier: BuildTeamIdentifier): Promise<BuildTeam|null> {
        const api_keys = this.getAPIKeys();

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

    /** Returns information about the build team. **/
    async getCountryTeamsList(){
        if(this.countryTeamsList == null)
            this.countryTeamsList = await this.getCountryTeamsListFromDatabase();

        if(this.countryTeamsList == null)
            return null;

        // Read the countries.json file
        const filePath = path.join(process.cwd(), 'lib', 'countries.json');
        const rawData = await fs.readFile(filePath, 'utf-8');
        const countriesData = JSON.parse(rawData);

        let countryTeamsListCopy = JSON.parse(JSON.stringify(this.countryTeamsList));


        for (const country of countryTeamsListCopy) 
        for (const countryData of countriesData) 
            if(countryData.cca3 == country.RegionCode){

                // Add the parameters "cca2", "ccn3", "cioc", "region", "subregion", "capital", "languages", "latlng", "area", "borders" to the countryTeamsListCopy
                country.cca2 = countryData.cca2;
                country.ccn3 = countryData.ccn3;
                country.cioc = countryData.cioc;
                country.region = countryData.region;
                country.subregion = countryData.subregion;
                country.capital = countryData.capital;
                country.languages = countryData.languages;
                country.latlng = countryData.latlng;
                country.area = countryData.area;
                country.borders = countryData.borders;

                break;
            }
        
        return countryTeamsListCopy;
    }

    /** Returns a list of all warps. If no warps are found, an empty list is returned.*/
    async getWarps(){
        return await this.getWarpsFromDatabase();
    }



    // Validate values

    // Validate an API key that looks like this "fffb262b-0324-499a-94a6-eebf845e6123"
    validateAPIKey(req: express.Request, res: express.Response): boolean {
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
        const api_keys = this.getAPIKeys();

        if (!api_keys.includes(req.params.apikey)) {
            res.status(401).send({ success: false, error: "Invalid API key" });
            return false;
        }

        return true;
    }

    // Validate a key that is either an API Key or a Build Team ID or a Build Team Tag or a BuildTeam Server ID
    async validateKey(req: express.Request, res: express.Response): Promise<BuildTeamIdentifier|null> {
        const apiKeys = this.getAPIKeys();

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
        const SQL = "SELECT APIKey FROM BuildTeams";
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

    private async getCountryTeamsListFromDatabase() {
        const SQL = "SELECT `RegionCode`, `BuildTeam`, `RegionName` FROM `BuildTeamRegions` WHERE `RegionType` = 'COUNTRY'";
        return await this.networkDatabase.query(SQL); // result: [{"RegionCode":"ABW","BuildTeam":"m3pKPALP","RegionName":"Aruba"}]
    }

    private async getWarpsFromDatabase(){
        const SQL = "SELECT * FROM BuildTeamWarps";
        return await this.networkDatabase.query(SQL);
    }
}
