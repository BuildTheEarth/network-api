import { Router } from "express";
import Network from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.get('/api/teams/warpgroups', async function (req, res) {
        
        let value = await network.getBuildTeamWarpGroups();
            
        if(value == null) {
            res.status(400).send({ error: 'Warp Groups not found' });
            return;
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(value))
    })
}
