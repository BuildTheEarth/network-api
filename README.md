<!-- markdownlint-disable -->
<div align="center">

<img width="128" src="https://buildtheearth.net/assets/img/site-logo-animated.gif" />

# Network API

_A REST-API to interface with data from the BuildTheEarth.net Minecraft Network._

![official](https://go.buildtheearth.net/official-shield)
[![chat](https://img.shields.io/discord/690908396404080650?label=Discord&color=768AD4)](https://discord.gg/buildtheearth)

</div>
<!-- markdownlint-restore -->

> Formerly known as PlotSystemAPI

## Routes

Network API Documentation: 
https://buildtheearth.github.io/network-api/


## Installation

- Install [Node.js](https://nodejs.org/en/) version 18.12.1 or higher
- Clone the repository by clicking the green "Code" button on this page or by entering this command:
```bash
git clone <github clone url>
```
- Change the name from `_config.json5` to `config.json5` and enter the correct values for your server.
- Install the dependencies
```bash
cd network-api
npm install
```
- Build the system
```bash
npm run build
```
- Start the server
```bash
npm start
```
Open [http://localhost:8080](http://localhost:8080) with your browser to see the result.
