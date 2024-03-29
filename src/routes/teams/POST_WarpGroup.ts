import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.post('/api/teams/:apikey/warpgroups', async function (req, res) {

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
            id: joi.string().optional(),
            name: joi.string().required(),
            description: joi.string().optional(),
            slot: joi.number().optional(),
            material: joi.string().optional()
        });

        const validation = schema.validate(req.body);

        // If the validation failed, return an error
        if(validation.error != null){
            res.status(400).send({success: false, error: validation.error.details[0].message});
            return;
        }


        // Get the parameters from the request
        const id = req.body.id;                             // The id of the warp.
        const name = req.body.name;                         // The name of the warp.
        const description = req.body.description;           // The description of the warp.
        let slot = req.body.slot;                         // The slot of the warp.
        let material = req.body.material;                 // The material of the warp.

        // If the slot is not provided, or is invalid, set it to -1
        if(slot == undefined || slot < 0 || slot >= 27)
            slot = -1;

        // If the material is not specified, set it to null
        if(material == undefined)
            material = null;

        // Create a new warp
        const promise = buildTeam.createWarpGroup(id, name, description, slot, material);


        // Wait for the promise to resolve
        promise.then((success) => {
            // If the warp was not created, return an error
            if(!success){
                res.status(400).send({success: false, error: 'An error occurred while creating the warp group'});
                return;
            }

            // Return the success message to the client
            res.setHeader('Content-Type', 'application/json');
            res.send({success: true})
        })       
    })
}