import { Router } from "express";
import Network from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.get('/api/countries', async function (req, res) {

        //TODO get a json of all countries from the DB
        const countries = "placeholder";

        if(countries == null) {
            res.status(400).send({ error: 'No countries found.' });
            return;
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(countries))
    })
}