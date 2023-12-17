import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {
    app.get('/api/plotsystem/teams/:apikey/orders/:orderId/confirm', async function (req, res) {

        // Validate that the API key is a valid GUID
        if(!network.validateAPIKeyAndOrderID(req, res))
            return;

        const buildTeam = await network.getBuildTeam(req.params.apikey, BuildTeamIdentifier.APIKey);

        if(buildTeam == null) {
            res.status(400).send({ error: 'Build Team not found' });
            return;
        }

        if(req.params.orderId == null){
            res.status(400).send({success: false, error: 'Missing orderId'});
            return;
        }
        
        const success = await buildTeam.confirmPSOrder(req.params.orderId);

        res.setHeader('Content-Type', 'application/json');

        if(!success){
            res.status(400).send({success: false, error: 'An error occurred while creating the plot'});
            return;
        }

        // Return the success message to the client
        res.send({success: true})
    })

}