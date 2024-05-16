import { Router } from "express";
import Network from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    app.get('/api/players/stats/:uuid', async function (req, res) {

        //Validate that the UUID parameter is valid
        if(!uuidV4Regex.test(req.params.uuid)) {
            return res.status(400).json({ error: 'Invalid UUID format'})
        }

        
    })
}