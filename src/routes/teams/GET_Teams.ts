import { Router } from "express";
import Network from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.get('/api/teams', async function (req, res) {

        const buildTeamInfo = await network.getBuildTeamInfo();

        if(buildTeamInfo == null) {
            res.status(400).send({ error: 'No Build Team found' });
            return;
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(buildTeamInfo))
    })
}