import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    // A delete request to delete the plot of a build team
    app.delete('/api/plotsystem/teams/:apikey/plots', async function (req, res) {

        // Validate that the API key is a valid GUID
        if(!await network.validateAPIKey(req, res))
            return;


        // Get the plot id
        let plotid: number | null = null;

        if(req.query.id !== undefined && req.query.id !== null)
            plotid = Number(req.query.id);

        else if(req.body.id !== undefined && req.body.id !== null)
            plotid = Number(req.body.id);

        else if(Array.isArray(req.body) && req.body[0]?.id !== undefined && req.body[0]?.id !== null)
            plotid = Number(req.body[0].id);

        if(plotid == null){
            res.status(400).send({ error: 'Missing plot id' });
            return;
        }
        const finalPlotID = plotid;



        // Get the build team
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
            buildTeam.deletePSPlot(finalPlotID).then((success) => {
                if(!success){
                    res.status(400).send({ error: 'An error occurred while deleting the plot' });
                    return;
                }

                res.status(200).send({ success: true });  
            });
        });           
    })

}