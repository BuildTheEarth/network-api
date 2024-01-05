import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.put('/api/teams/:apikey/hasBuildTeamToolsInstalled', async function (req, res) {

        console.log("Step 1"); 
        // Validate that the API key is a valid GUID
        if(!network.validateAPIKey(req, res))
            return;

        console.log("Step 2"); 
        
        const buildTeam = await network.getBuildTeam(req.params.apikey, BuildTeamIdentifier.APIKey); 

        console.log("Step 3");

        if(buildTeam == null) {
            res.status(400).send({ error: 'Build Team not found' });
            return;
        }

        console.log("Step 4");

        // Validate the parameters with joi
        const schema = joi.object({
            hasBuildTeamToolsInstalled: joi.boolean().required()
        });

        console.log("Step 5");

        const validation = schema.validate(req.body);

        console.log("Step 6");


        // If the validation failed, return an error
        if(validation.error != null){
            console.log(validation.error)
            console.log(req.body.hasBuildTeamToolsInstalled)
            console.log(req.body)

            res.status(400).send({success: false, error: validation.error.details[0].message});
            return;
        }

        console.log("Step 7");

        // Get the parameters from the request
        let hasBuildTeamToolsInstalled = req.body.hasBuildTeamToolsInstalled;   // The new value of the variable hasBuildTeamToolsInstalled

        console.log("Step 8");

        // Update the variable
        const promise = buildTeam.setHasBuildTeamToolsInstalled(hasBuildTeamToolsInstalled);

        console.log("Step 9");

        // Wait for the promise to resolve
        promise.then((result: any) => {
            // If the variable was not updated, return an error
            if(result != true){
                res.status(400).send({success: false, error: 'An error occurred while updating the variable hasBuildTeamToolsInstalled: ' + result});
                return;
            }

            // Return the success message to the client
            res.setHeader('Content-Type', 'application/json');
            res.send({success: true})
        })
    })
}