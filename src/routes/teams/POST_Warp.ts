import { Router } from "express";
import Network, { AddressType, BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.post('/api/teams/:apikey/warps', async function (req, res) {

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
            warpGroupID: joi.string().optional(),
            countryCode: joi.string().required(),
            countryCodeType: joi.string().required().valid('cca2', 'cca3', 'ccn3', 'cioc'),
            address: joi.string().optional(),
            addressType: joi.string().optional(),
            material: joi.string().optional(),

            worldName: joi.string().required(),
            lat: joi.number().required(),
            lon: joi.number().required(),
            y: joi.number().required(),
            yaw: joi.number().required(),
            pitch: joi.number().required(),

            isHighlight: joi.boolean().required()
        });

        const validation = schema.validate(req.body);

        // If the validation failed, return an error
        if(validation.error != null){
            res.status(400).send({success: false, error: validation.error.details[0].message});
            return;
        }


        // Get the parameters from the request
        const id = req.body.id;                                                                 // The id of the warp.
        const warpGroupID = req.body.warpGroupID                                                // The id of the warp group.
        const name = req.body.name;                                                             // The name of the warp.
        const countryCode = req.body.countryCode;                                               // Country Code that matches the countryCodeType.
        const countryCodeType = req.body.countryCodeType;                                       // Country Code Type like cca2, cca3, ccn3, or cioc.
        const address = req.body.address;                                                       // The address of the warp.
        const addressType: AddressType = convertStringToAddressType(req.body.addressType);      // The type of address. (BUILDING, STREET, CITY, STATE, COUNTRY, CUSTOM)
        let material = req.body.material;                                                     // The material of the warp.

        const worldName = req.body.worldName;                                                   // The name of the world the warp is in.
        const lat = req.body.lat;                                                               // The latitude of the warp.
        const lon = req.body.lon;                                                               // The longitude of the warp.
        const y = req.body.y;                                                                   // The y coordinate of the warp.
        const yaw = req.body.yaw;                                                               // The yaw of the warp.
        const pitch = req.body.pitch;                                                           // The pitch of the warp.

        const isHighlight = req.body.isHighlight;                                               // Whether the warp is a highlight or not.


        // If the addressType is CUSTOM and the address is not specified, return an error
        if(addressType == AddressType.CUSTOM && address == null){
            res.status(400).send({success: false, error: 'Address must be specified when addressType is CUSTOM'});
            return;
        }

        // If the material is not specified, set it to null
        if(material == undefined)
            material = null;

        // Create a new warp
        const promise = buildTeam.createWarp(id, warpGroupID, name, countryCode, countryCodeType, address, addressType, material, worldName, lat, lon, y, yaw, pitch, isHighlight);


        // Wait for the promise to resolve
        promise.then((success) => {
            // If the warp was not created, return an error
            if(!success){
                res.status(400).send({success: false, error: 'An error occurred while creating the warp'});
                return;
            }

            // Return the success message to the client
            res.setHeader('Content-Type', 'application/json');
            res.send({success: true})
        })       
    })

    function convertStringToAddressType(input: string): AddressType {
        if (input in AddressType) 
            return AddressType[input as keyof typeof AddressType];

        return AddressType.CITY;
    }
}