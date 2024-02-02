import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.delete('/api/teams/:apikey/warps', async function (req, res) {

        // Validate that the API key is a valid GUID
        if(!await network.validateAPIKey(req, res))
            return;
        
        const buildTeam = await network.getBuildTeam(req.params.apikey, BuildTeamIdentifier.APIKey);   

        if(buildTeam == null) {
            res.status(400).send({ error: 'Build Team not found' });
            return;
        }

        // Validate the parameters with joi
        const schema = joi.object({
            key: joi.string().required()
        });

        const validation = schema.validate(req.body);

        // If the validation failed, return an error
        if(validation.error != null){
            res.status(400).send({success: false, error: validation.error.details[0].message});
            return;
        }


        // Get the parameters from the request
        const key = req.body.key;  // The name or ID of the warp.

        const warps = await buildTeam.getWarps();
        if(warps.find((warp: any) => (warp.Name == key || warp.ID == key)) == null){
            res.status(400).send({success: false, error: 'Warp not found in this team.'});
            return;
        }


        // Create a new warp
        const promise = buildTeam.deleteWarp(key);


        // Wait for the promise to resolve
        promise.then((success) => {
            // If the warp was not created, return an error
            if(!success){
                res.status(400).send({success: false, error: 'An error occurred while deleting the warp'});
                return;
            }

            // Return the success message to the client
            res.setHeader('Content-Type', 'application/json');
            res.send({success: true})
        })       
    })
}