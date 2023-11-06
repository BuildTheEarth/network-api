import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {
    app.get('/api/plotsystem/teams/:apikey/cities', async function (req, res) {

        // Validate that the API key is a valid GUID
        if(!network.validateAPIKey(req, res))
            return;

        const buildTeam = await network.getBuildTeam(req.params.apikey, BuildTeamIdentifier.APIKey);

        if(buildTeam == null) {
            res.status(400).send({ error: 'Build Team not found' });
            return;
        }
        
        const cities = await buildTeam.getPSCities();
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(cities))
    })

}