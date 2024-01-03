import { Router } from "express";
import Network, { BuildTeamIdentifier } from "../../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    // A put request to change plot settings of a build team
    app.put('/api/plotsystem/teams/:apikey/plots', async function (req, res) {

        // Validate that the API key is a valid GUID
        if(!network.validateAPIKey(req, res))
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

            // Get the parameters from the request
            let cityProjectID = plot.city_project_id;
            let difficultyID = plot.difficulty_id;
            let reviewID = plot.review_id;
            let ownerUUID = plot.owner_uuid;
            let memberUUIDs = plot.member_uuids;
            let status = plot.status;
            let mcCoordinates = plot.mc_coordinates;
            let outline = plot.outline;
            let score = plot.score;
            let lastActivity = plot.last_activity;
            let pasted = plot.pasted;
            let type = plot.type;
            let version = plot.version;

            if(req.body[0].city_project_id != null)
                cityProjectID = req.body[0].city_project_id;
            if(req.body[0].difficulty_id != null)
                difficultyID = req.body[0].difficulty_id;
            if(req.body[0].review_id != null)
                reviewID = req.body[0].review_id;
            if(req.body[0].owner_uuid != null)
                ownerUUID = req.body[0].owner_uuid;
            if(req.body[0].member_uuids != null)
                memberUUIDs = req.body[0].member_uuids;
            if(req.body[0].status != null)
                status = req.body[0].status;
            if(req.body[0].mc_coordinates != null)  
                mcCoordinates = req.body[0].mc_coordinates;
            if(req.body[0].outline != null)
                outline = req.body[0].outline;
            if(req.body[0].score != null)
                score = req.body[0].score;
            if(req.body[0].last_activity != null)
                lastActivity = req.body[0].last_activity;
            if(req.body[0].pasted != null)
                pasted = req.body[0].pasted;
            if(req.body[0].type != null)
                type = req.body[0].type;
            if(req.body[0].version != null)
                version = req.body[0].version;

            
            // Update the plot
            buildTeam.updatePSPlot(finalPlotID, cityProjectID, difficultyID, reviewID, ownerUUID, memberUUIDs, status, mcCoordinates, outline, score, lastActivity, pasted, type, version).then((success) => {
                if(!success){
                    res.status(400).send({ error: 'An error occurred while updating the plot' });
                    return;
                }

                res.status(200).send({ success: true });  
            });
        });           
    })

}