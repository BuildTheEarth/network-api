import { Router } from "express";
import Network from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.get('/api/teams/:key', async function (req, res) {

        // Validate that the Key is a valid API Key or Build Team ID or Build Team Tag or BuildTeam Server ID
        const type = await network.validateKey(req, res)
        if(type == null)
            return;

        const buildTeam = await network.getBuildTeam(req.params.key, type);

        if(buildTeam == null || buildTeam == undefined) {
            res.status(400).send({ error: 'Build Team not found' });
            return;
        }

        const info = await buildTeam.getBuildTeamInfo(null);

        if(info == null || info == undefined) {
            res.status(400).send({ error: 'Build Team Info not found' });
            return;
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(info))
    })
}