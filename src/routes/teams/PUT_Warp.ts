import { Router } from "express";
import Network, { AddressType, BuildTeamIdentifier } from "../../struct/core/network.js";

export async function initRoutes(app: Router, joi: any, network: Network) {

    app.put('/api/teams/:apikey/warps', async function (req, res) {

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
            warpGroupID: joi.string().optional(),

            name: joi.string().optional(),
            countryCode: joi.string().optional(),
            countryCodeType: joi.string().optional().valid('cca2', 'cca3', 'ccn3', 'cioc'),
            address: joi.string().optional(),

            worldName: joi.string().optional(),
            lat: joi.number().optional(),
            lon: joi.number().optional(),
            y: joi.number().optional(),
            yaw: joi.number().optional(),
            pitch: joi.number().optional(),

            isHighlight: joi.boolean().optional()
        });

        const validation = schema.validate(req.body);

        // If the validation failed, return an error
        if(validation.error != null){
            res.status(400).send({success: false, error: validation.error.details[0].message});
            return;
        }

        // Get the current warp
        const warps = await buildTeam.getWarps();
        const warp = warps.find((warp: any) => warp.ID == req.body.id);

        // If the warp was not found, return an error
        if(warp == null){
            res.status(400).send({success: false, error: 'Warp not found in this team.'});
            return;
        }

        // Get the parameters from the request
    let id = warp.ID;                                                                           // The ID of the warp.
        let warpGroupID = warp.WarpGroupID;                                                     // The ID of the warp group.
        let name = warp.Name;                                                                   // The name of the warp.
        let countryCode = warp.CountryCode;                                                     // Country Code that matches the countryCodeType.
        let countryCodeType = "cca3";                                                           // Country Code Type like cca2, cca3, ccn3, or cioc.
        let address = warp.Address;                                                             // The address of the warp.
        let addressType: AddressType = convertStringToAddressType(req.body.addressType);        // The type of address. (BUILDING, STREET, CITY, STATE, COUNTRY, CUSTOM)
        let material = warp.Material;                                                           // The material of the warp.

        let worldName = warp.WorldName;                                                         // The name of the world the warp is in.
        let lat = warp.Latitude;                                                                // The latitude of the warp.
        let lon = warp.Longitude;                                                               // The longitude of the warp.
        let y = warp.Height;                                                                    // The y coordinate of the warp.
        let yaw = warp.Yaw;                                                                     // The yaw of the warp.
        let pitch = warp.Pitch;                                                                 // The pitch of the warp.

        let isHighlight = warp.IsHighlight;                                                     // Whether the warp is a highlight or not.


        // If the parameter was specified, set it
        if(req.body.id != null)
            id = req.body.id;
        if(req.body.warpGroupID != null)
            warpGroupID = req.body.warpGroupID;
        if(req.body.name != null)
            name = req.body.name;
        if(req.body.countryCode != null)
            countryCode = req.body.countryCode;
        if(req.body.countryCodeType != null)
            countryCodeType = req.body.countryCodeType;
        if(req.body.address != null)
            address = req.body.address;
        if(req.body.addressType != null)
            addressType = req.body.addressType;
        if(req.body.material != null)
            material = req.body.material;
        if(req.body.worldName != null)
            worldName = req.body.worldName;
        if(req.body.lat != null)
            lat = req.body.lat;
        if(req.body.lon != null)
            lon = req.body.lon;
        if(req.body.y != null)
            y = req.body.y;
        if(req.body.yaw != null)
            yaw = req.body.yaw;
        if(req.body.pitch != null)
            pitch = req.body.pitch;
        if(req.body.isHighlight != null)
            isHighlight = req.body.isHighlight;

        
        if(addressType == AddressType.CUSTOM && address == null){
            res.status(400).send({success: false, error: 'Address must be specified when addressType is CUSTOM'});
            return;
        }

        if(material == undefined)
            material = null;


        // Update the warp
        const promise = buildTeam.updateWarp(id, warpGroupID, name, countryCode, countryCodeType, address, addressType, material, worldName, lat, lon, y, yaw, pitch, isHighlight);


        // Wait for the promise to resolve
        promise.then((success) => {
            // If the warp was not created, return an error
            if(!success){
                res.status(400).send({success: false, error: 'An error occurred while updating the warp'});
                return;
            }

            // Return the success message to the client
            res.setHeader('Content-Type', 'application/json');
            res.send({success: true})
        })       
    })

    function convertStringToAddressType(input: string): AddressType {
        if (input in AddressType) {
            return AddressType[input as keyof typeof AddressType];
        }
        return AddressType.CITY;
    }
}