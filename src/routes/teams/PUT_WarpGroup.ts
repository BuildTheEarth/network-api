import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.put('/api/teams/:apikey/warpgroups', async function (req, res) {

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
            id: joi.string().required(),
            name: joi.string().optional(),
            description: joi.string().optional()
        });

        const validation = schema.validate(req.body);

        // If the validation failed, return an error
        if(validation.error != null){
            res.status(400).send({success: false, error: validation.error.details[0].message});
            return;
        }

        // Get the current warp
        const warps = await buildTeam.getWarpGroups();
        const warp = warps.find((warp: any) => warp.ID == req.body.id);

        // If the warp was not found, return an error
        if(warp == null){
            res.status(400).send({success: false, error: 'Warp Group not found in this team.'});
            return;
        }

        // Get the parameters from the request
        let id = warp.ID;                       // The ID of the warp.
        let name = warp.Name;                   // The name of the warp.
        let description = warp.Description;     // The description of the warp.

        // If the parameter was specified, set it
        if(req.body.id != null)
            id = req.body.id;
        if(req.body.name != null)
            name = req.body.name;
        if(req.body.description != null)
            description = req.body.description;


        // Update the warp
        const promise = buildTeam.updateWarpGroup(id, name, description);


        // Wait for the promise to resolve
        promise.then((success) => {
            // If the warp was not created, return an error
            if(!success){
                res.status(400).send({success: false, error: 'An error occurred while updating the warp group.'});
                return;
            }

            // Return the success message to the client
            res.setHeader('Content-Type', 'application/json');
            res.send({success: true})
        })       
    })
}