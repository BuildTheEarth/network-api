import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.put('/api/teams/:apikey/hasBuildTeamToolsInstalled', async function (req, res) {

        // Validate that the API key is a valid GUID
        if(!network.validateAPIKey(req, res))
            return;
        
        const buildTeam = await network.getBuildTeam(req.params.apikey, BuildTeamIdentifier.APIKey); 

        if(buildTeam == null) {
            res.status(400).send({ error: 'Build Team not found' });
            return;
        }

        // Validate the parameters with joi
        const schema = joi.object({
            hasBuildTeamToolsInstalled: joi.boolean().required()
        });

        const validation = schema.validate(req.body);

        // If the validation failed, return an error
        if(validation.error != null){
            res.status(400).send({success: false, error: validation.error.details[0].message});
            return;
        }

        // Get the current warp
        const warps = await buildTeam.getWarps();
        const warp = warps.find((warp: any) => warp.ID == req.body.ID);

        // If the warp was not found, return an error
        if(warp == null){
            res.status(400).send({success: false, error: 'Warp not found in this team.'});
            return;
        }

        // Get the parameters from the request
        let hasBuildTeamToolsInstalled = req.body.hasBuildTeamToolsInstalled;   // The new value of the variable hasBuildTeamToolsInstalled

        // Update the variable
        const promise = buildTeam.setHasBuildTeamToolsInstalled(hasBuildTeamToolsInstalled);


        // Wait for the promise to resolve
        promise.then((success) => {
            // If the variable was not updated, return an error
            if(!success){
                res.status(400).send({success: false, error: 'An error occurred while updating the variable hasBuildTeamToolsInstalled'});
                return;
            }

            // Return the success message to the client
            res.setHeader('Content-Type', 'application/json');
            res.send({success: true})
        })       
    })
}