const initRoutes = async (app, joi, plotSystem) => {

    app.get('/api/teams/:apikey/reviews', function (req, res) {

        // Validate that the API key is a valid GUID
        if(!plotSystem.validateAPIKey(joi, req, res))
            return;
        

        const buildTeam = plotSystem.getBuildTeam(req.params.apikey);
        buildTeam.getReviews().then((reviews) => {
            res.send(JSON.stringify(reviews))
        })
    })

}

module.exports = { initRoutes }