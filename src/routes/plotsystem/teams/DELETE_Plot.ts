import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    // A delete request to delete the plot of a build team
    app.delete('/api/plotsystem/teams/:apikey/plots', async function (req, res) {

        // Validate that the API key is a valid GUID
        if(!network.validateAPIKey(req, res))
            return;

        const plotid = req.body[0].id;

        if(plotid == null){
            res.status(400).send({ error: 'Missing plot id' });
            return;
        }

        const buildTeam = await network.getBuildTeam(req.params.apikey, BuildTeamIdentifier.APIKey);
        
        if(buildTeam == null) {
            res.status(400).send({ error: 'Build Team not found' });
            return;
        }

        if(!buildTeam.isValidPSPlot(plotid)) {
            res.status(400).send({ error: 'Plot could not be found' });
            return;
        }

        buildTeam.getPSPlot(plotid).then((plot) => {

            if(plot == null){
                res.status(400).send({ error: 'Plot not found' });
                return;
            }



            // Delete the plot
            buildTeam.deletePSPlot(plotid).then((success) => {
                if(!success){
                    res.status(400).send({ error: 'An error occurred while deleting the plot' });
                    return;
                }

                res.status(200).send({ success: true });  
            });
        });           
    })

}