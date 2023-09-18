export  async function initRoutes(app, joi, plotSystem) {

    app.get('/api/plotsystem/teams/:apikey/plots', function (req, res) {

        // Validate that the API key is a valid GUID
        if(!plotSystem.validateAPIKey(req, res))
            return;
        

        const buildTeam = plotSystem.getBuildTeam(req.params.apikey);

        buildTeam.getPSPlots().then((plots) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(plots))
        })
    })

}