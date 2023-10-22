import { Router } from "express";
import Network from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.get('/api/teams/countries', async function (req, res) {

        // Get a json of all countries from the DB in the specified format
        const countries = await network.getCountryTeamsList();

        if (countries == null) {
            res.status(400).send({ error: 'No countries found.' });
            return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(countries));
    });
}
