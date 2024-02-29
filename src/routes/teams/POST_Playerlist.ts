import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.post('/api/teams/:apikey/playerlist', async function (req, res) {

        // Validate that the API key is a valid GUID
        if(!await network.validateAPIKey(req, res))
            return;
        
        const buildTeam = await network.getBuildTeam(req.params.apikey, BuildTeamIdentifier.APIKey);  

        if(buildTeam == null) {
            res.status(400).send({ error: 'Build Team not found' });
            return;
        }

        // Validate the parameters with joi

        // Schema for a single UUID and username pair
        const uuidUsernameSchema = joi.array().ordered(
            joi.string().guid({ version: 'uuidv4' }), // Validates a UUID (version 4)
            joi.string() // Validates a simple string for the username
        ).length(2);

        // Schema for the main array, containing multiple UUID-username pairs
        const schema = joi.array().items(uuidUsernameSchema);

        const validation = schema.validate(req.body);

        // If the validation failed, return an error
        if(validation.error != null){
            res.status(400).send({success: false, error: validation.error.details[0].message});
            return;
        }


        const result = await buildTeam.updatePlayerlist(req.body);

        

        // If the playerlist was not updated, return an error
        if(result == false){
            res.status(400).send({success: false, error: 'An error occurred while updating the playerlist'});
            return;
        }else{
            // Return the order id to the client
            res.setHeader('Content-Type', 'application/json');
            res.send({success: true})
        }           
    })
}