import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {
    app.get('/api/internal/:apikey/stats', async function (req, res) {

        // Validate that the API key is a valid GUID of the test Build Team
        if(!await network.validateAPIKey(req, res))
            return;

        // Get the Build Team
        const buildTeam = await network.getBuildTeam(req.params.apikey, BuildTeamIdentifier.APIKey);

        if(buildTeam == null) {
            res.status(400).send({ error: 'Please provide a valid API key' });
            return;
        }

        // Validate that the Build Team is the test Build Team
        if(buildTeam.getBuildTeamID() != "qtS6b2an"){
            res.status(400).send({ error: 'Please provide a valid API key' });
            return;
        }

        const stats = await network.getStats();

        if(stats == null) {
            res.status(400).send({ error: 'Stats could not get loaded' });
            return;
        }
        
        
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(stats))
    })

}