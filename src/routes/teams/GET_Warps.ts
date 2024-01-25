import { Router } from "express";
import Network from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.get('/api/teams/warps', async function (req, res) {

        const country = req.query.country;      // (Optional) Only get warps from this country
        
        let value = await network.getBuildTeamWarps();

        if(country != null)
            value = value.filter((warp: any) => warp.CountryCode == country);

            
        if(value == null) {
            res.status(400).send({ error: 'Warps not found' });
            return;
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(value))
    })
}
